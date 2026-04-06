import { createServer, type Socket } from "node:net";
import { existsSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { output } from "./output.js";

const SOCKET_PATH = "/tmp/rbxstudio-daemon.sock";
const PID_PATH = "/tmp/rbxstudio-daemon.pid";
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const DEFAULT_STUDIO_MCP_MAC =
  "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP";
const DEFAULT_STUDIO_MCP_WIN = "cmd.exe";
const WIN_ARGS = ["/c", "%LOCALAPPDATA%\\Roblox\\mcp.bat"];

function getStudioMcpCommand(): { command: string; args: string[] } {
  const custom = process.env.STUDIO_MCP_PATH;
  if (custom) return { command: custom, args: [] };
  if (process.platform === "win32") {
    return { command: DEFAULT_STUDIO_MCP_WIN, args: WIN_ARGS };
  }
  return { command: DEFAULT_STUDIO_MCP_MAC, args: [] };
}

const READY_PATH = "/tmp/rbxstudio-daemon.ready";
const DISCOVERY_TIMEOUT_MS = 15_000; // max time to wait for Studio discovery
const DISCOVERY_POLL_MS = 500;

export async function startDaemon(quiet = false): Promise<void> {
  const log = quiet ? () => {} : output;

  // Check if already running
  if (existsSync(PID_PATH)) {
    const pid = parseInt(readFileSync(PID_PATH, "utf-8").trim(), 10);
    try {
      process.kill(pid, 0); // check if process exists
      log(`Daemon already running (pid: ${pid})`);
      return;
    } catch {
      // stale pid file, clean up
      cleanupFiles();
    }
  }

  // Fork to background
  if (process.env.RBX_DAEMON_FOREGROUND !== "1") {
    // Remove stale ready file before starting
    try { unlinkSync(READY_PATH); } catch { /* ignore */ }

    const { fork } = await import("node:child_process");
    const child = fork(process.argv[1], ["daemon", "start"], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, RBX_DAEMON_FOREGROUND: "1" },
    });
    child.unref();

    // Wait for daemon to signal ready (Studio discovered)
    const start = Date.now();
    while (Date.now() - start < DISCOVERY_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, DISCOVERY_POLL_MS));
      if (existsSync(READY_PATH)) {
        const info = readFileSync(READY_PATH, "utf-8").trim();
        log(`Daemon started (pid: ${child.pid})`);
        if (info) log(info);
        return;
      }
      // Check if child died
      if (child.exitCode !== null) {
        log("Daemon failed to start.");
        return;
      }
    }

    log(`Daemon started (pid: ${child.pid}) but Studio not yet discovered. It may take a moment.`);
    return;
  }

  // We're the daemon process now
  let mcpClient: Client | null = null;
  let connectingPromise: Promise<Client> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      shutdown();
    }, IDLE_TIMEOUT_MS);
  };

  // Serialized MCP connection — ensures only one connect attempt at a time
  async function connectMcp(): Promise<Client> {
    if (mcpClient) return mcpClient;
    if (connectingPromise) return connectingPromise;

    connectingPromise = (async () => {
      const { command, args } = getStudioMcpCommand();
      const transport = new StdioClientTransport({ command, args });
      const client = new Client(
        { name: "rbxstudio-cli-daemon", version: "1.0.0" },
        { capabilities: {} },
      );
      await client.connect(transport);
      mcpClient = client;
      connectingPromise = null;
      return client;
    })();

    return connectingPromise;
  }

  function extractStudios(result: { content: unknown }): Array<{ name?: string }> | null {
    try {
      const text = (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
      const data = JSON.parse(text);
      const studios = Array.isArray(data) ? data : data.studios;
      if (Array.isArray(studios) && studios.length > 0) return studios;
    } catch { /* ignore parse errors */ }
    return null;
  }

  // Run discovery in background — does not block server
  async function runDiscovery(): Promise<void> {
    try {
      const client = await connectMcp();
      const start = Date.now();
      while (Date.now() - start < DISCOVERY_TIMEOUT_MS) {
        try {
          const result = await client.callTool({
            name: "list_roblox_studios",
            arguments: {},
          });
          const studios = extractStudios(result as { content: unknown });
          if (studios) {
            const names = studios.map((s) => s.name ?? "Unnamed").join(", ");
            writeFileSync(READY_PATH, `Connected to: ${names}`);
            return;
          }
        } catch {
          // MCP call failed, retry
        }
        await new Promise((r) => setTimeout(r, DISCOVERY_POLL_MS));
      }
    } catch {
      // connectMcp failed entirely
    }
    // Timed out or failed — still write ready file so parent stops waiting
    writeFileSync(READY_PATH, "");
  }

  async function handleConnection(socket: Socket) {
    resetIdleTimer();
    let data = "";
    let processed = false;

    async function processRequest() {
      if (processed) return;
      const newlineIdx = data.indexOf("\n");
      if (newlineIdx === -1) return;
      processed = true;

      try {
        const request = JSON.parse(data.slice(0, newlineIdx));
        const client = await connectMcp();
        const result = await client.callTool({
          name: request.name,
          arguments: request.args ?? {},
        });
        socket.end(JSON.stringify(result));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        socket.end(JSON.stringify({ error: msg }));
        if (mcpClient) {
          try { await mcpClient.close(); } catch { /* ignore */ }
          mcpClient = null;
        }
      }
    }

    socket.on("data", (chunk) => {
      data += chunk.toString();
      processRequest();
    });

    socket.on("error", () => {
      // client disconnected unexpectedly, ignore
    });
  }

  function cleanupFiles() {
    try { unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
    try { unlinkSync(PID_PATH); } catch { /* ignore */ }
    try { unlinkSync(READY_PATH); } catch { /* ignore */ }
  }

  async function shutdown() {
    if (mcpClient) {
      try { await mcpClient.close(); } catch { /* ignore */ }
    }
    cleanupFiles();
    server.close();
    process.exit(0);
  }

  // Clean up stale socket
  if (existsSync(SOCKET_PATH)) {
    unlinkSync(SOCKET_PATH);
  }

  const server = createServer(handleConnection);
  server.listen(SOCKET_PATH, () => {
    writeFileSync(PID_PATH, String(process.pid));
    resetIdleTimer();
    // Fire-and-forget: eagerly connect and discover Studio
    runDiscovery();
  });

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export async function stopDaemon(): Promise<void> {
  if (!existsSync(PID_PATH)) {
    output("Daemon is not running.");
    return;
  }

  const pid = parseInt(readFileSync(PID_PATH, "utf-8").trim(), 10);
  try {
    process.kill(pid, "SIGTERM");
    output(`Daemon stopped (pid: ${pid})`);
  } catch {
    output("Daemon process not found. Cleaning up stale files.");
  }

  try { unlinkSync(PID_PATH); } catch { /* ignore */ }
  try { unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
}

/**
 * Ensure the daemon is running. Auto-starts it if not.
 * Called by smart-client before every tool call.
 */
export async function ensureDaemon(): Promise<void> {
  // Quick check: if socket exists and process is alive, daemon is running
  if (existsSync(SOCKET_PATH) && existsSync(PID_PATH)) {
    const pid = parseInt(readFileSync(PID_PATH, "utf-8").trim(), 10);
    try {
      process.kill(pid, 0);
      return; // daemon is running
    } catch {
      // stale, fall through to start
    }
  }

  // Start daemon quietly (this blocks until Studio is discovered or timeout)
  await startDaemon(true);
}

export async function daemonStatus(): Promise<void> {
  if (!existsSync(PID_PATH)) {
    output("Daemon is not running.");
    return;
  }

  const pid = parseInt(readFileSync(PID_PATH, "utf-8").trim(), 10);
  try {
    process.kill(pid, 0);
    output(`Daemon is running (pid: ${pid})`);
  } catch {
    output("Daemon is not running (stale pid file).");
    try { unlinkSync(PID_PATH); } catch { /* ignore */ }
    try { unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
  }
}
