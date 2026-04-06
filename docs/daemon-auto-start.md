# Daemon Auto-Start: Debugging & Fix

## The Problem

The `rbxstudio` CLI was designed to be a standalone alternative to connecting Roblox Studio's MCP server directly through Claude Code. The goal: Claude Code uses `rbxstudio` via Bash instead of MCP tools, saving thousands of tokens per conversation on tool schema overhead.

However, we discovered that `rbxstudio list` returned **no connected Studios** unless Claude Code's own MCP connection to Roblox Studio was already active — defeating the entire purpose of the CLI.

## Root Cause Analysis

### Discovery: StudioMCP needs time to find Studio (~3 seconds)

The `StudioMCP` binary (at `/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`) is a proxy that connects to Roblox Studio's MCP server. Through raw testing, we found:

- **MCP handshake completes in ~28ms** — the binary starts fast
- **Studio discovery takes ~1-3 seconds** — the binary needs time to find running Studio instances
- **Single-shot invocations miss the window** — the CLI would spawn StudioMCP, call `list_roblox_studios`, get an empty list, and exit before discovery completed

```
$ node -e '... raw MCP test ...'
Connected in 28ms
Attempt 1 (30ms):  0 studios   ← too early
Attempt 2 (1033ms): 0 studios  ← still discovering
Attempt 3 (2036ms): 0 studios  ← almost there
Attempt 4 (3039ms): 1 studios  ← found it!
```

When Claude Code's MCP was connected, its **persistent** StudioMCP process had already completed discovery. Our CLI's per-invocation spawns were essentially piggybacking on that — when both ran simultaneously, the CLI's fresh StudioMCP instance would sometimes find Studio faster because the persistent one had already established the connection state.

### Bug #2: Daemon socket protocol deadlock

The daemon's `handleConnection` waited for the socket `"end"` event before processing requests:

```typescript
// daemon.ts (before fix)
socket.on("end", async () => {
  const request = JSON.parse(data);
  // ... process request
});
```

But the client (`daemon-client.ts`) never called `socket.end()` after writing its request — it wrote data and waited for a response. Since the daemon waited for EOF and the client waited for a response, neither side would proceed. **This was a latent bug in the original code** that only manifested once we started testing the daemon more aggressively.

### Bug #3: Global install vs local build mismatch

During debugging, we spent significant time confused by why `writeFileSync` calls appeared to silently fail. Debug logging added to `daemon.ts` never appeared in the output files.

The root cause: `npm install -g .` had been run earlier, installing an **older version** of the CLI to `/usr/local/lib/node_modules/rbx-studio-cli/`. When the daemon forked a child process via `process.argv[1]` (which resolved to `/usr/local/bin/rbxstudio`), the child ran the **globally installed old code**, not the locally built version.

```
$ md5 /usr/local/lib/node_modules/rbx-studio-cli/dist/index.js  → b42915d...  (old)
$ md5 ./dist/index.js                                            → b94d534...  (new)
```

After `npm install -g .` synced the versions, everything worked.

## The Fix

### 1. Eager discovery on daemon startup (`daemon.ts`)

The daemon now eagerly connects to StudioMCP and polls `list_roblox_studios` when it starts, rather than waiting for the first client request:

```typescript
server.listen(SOCKET_PATH, () => {
  writeFileSync(PID_PATH, String(process.pid));
  resetIdleTimer();
  // Fire-and-forget: eagerly connect and discover Studio
  runDiscovery();
});
```

`runDiscovery()` runs as a non-blocking background task — it doesn't prevent the socket server from accepting connections. It polls every 500ms for up to 15 seconds, and writes a ready file when Studio is found.

### 2. Ready signaling between parent and daemon

The parent process (which forks the daemon) waits for a `/tmp/rbxstudio-daemon.ready` file before returning:

```
Parent process                     Daemon (forked child)
─────────────                      ─────────────────────
fork() ──────────────────────────► start server
poll for .ready file               connect to StudioMCP
  ...waiting...                    poll list_roblox_studios
  ...waiting...                      (empty)
  ...waiting...                    poll list_roblox_studios
  .ready file found! ◄────────────   (found!) → write .ready
return to caller                   continue serving
```

### 3. Auto-start daemon from any command (`smart-client.ts`, `ensureDaemon()`)

Every CLI command now calls `ensureDaemon()` before making a tool call. If no daemon is running, it auto-starts one (quietly, without polluting stdout):

```typescript
export async function callToolSmart(name, args) {
  await ensureDaemon();           // auto-start if needed (quiet)
  const result = await tryDaemonCall(name, args);
  if (result) return result;
  return callTool(name, args);    // fallback to single-shot
}
```

### 4. Fixed socket protocol (`handleConnection`)

Changed from waiting for `"end"` event to processing on first newline:

```typescript
// Before: waited for EOF (deadlocked with client)
socket.on("end", async () => { ... });

// After: processes immediately when newline arrives
socket.on("data", (chunk) => {
  data += chunk.toString();
  processRequest();  // triggers on first \n
});
```

### 5. Serialized MCP connection

Added a `connectingPromise` to prevent concurrent connection attempts when discovery and incoming requests race:

```typescript
async function connectMcp(): Promise<Client> {
  if (mcpClient) return mcpClient;
  if (connectingPromise) return connectingPromise;
  connectingPromise = (async () => { ... })();
  return connectingPromise;
}
```

## Result

The CLI now works **fully standalone** — no Claude Code MCP connection required:

```
$ rbxstudio daemon stop
Daemon stopped

$ rbxstudio tree --path game.Workspace    # auto-starts daemon
Workspace (Workspace)
Workspace.Camera (Camera)
Workspace.Baseplate (Part)
...
```

- **Cold start** (no daemon): ~4-5 seconds (daemon start + discovery + call)
- **Warm calls** (daemon running): instant via Unix socket
- **Explicit `rbxstudio daemon start`**: shows status messages
- **Auto-start from commands**: silent, clean output
