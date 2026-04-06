import { createServer, type Socket } from "node:net";
import { existsSync, unlinkSync, writeFileSync, readFileSync, rmSync } from "node:fs";
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

export async function startDaemon(): Promise<void> {
  // Check if already running
  if (existsSync(PID_PATH)) {
    const pid = parseInt(readFileSync(PID_PATH, "utf-8").trim(), 10);
    try {
      process.kill(pid, 0); // check if process exists
      output(`Daemon already running (pid: ${pid})`);
      return;
    } catch {
      // stale pid file, clean up
      cleanupFiles();
    }
  }

  // Fork to background
  if (process.env.RBX_DAEMON_FOREGROUND !== "1") {
    const { fork } = await import("node:child_process");
    const child = fork(process.argv[1], ["daemon", "start"], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, RBX_DAEMON_FOREGROUND: "1" },
    });
    child.unref();
    output(`Daemon started (pid: ${child.pid})`);
    return;
  }

  // We're the daemon process now
  let mcpClient: Client | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      shutdown();
    }, IDLE_TIMEOUT_MS);
  };

  async function connectMcp(): Promise<Client> {
    if (mcpClient) return mcpClient;
    const { command, args } = getStudioMcpCommand();
    const transport = new StdioClientTransport({ command, args });
    const client = new Client(
      { name: "rbxstudio-cli-daemon", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    mcpClient = client;
    return client;
  }

  async function handleConnection(socket: Socket) {
    resetIdleTimer();
    let data = "";

    socket.on("data", (chunk) => {
      data += chunk.toString();
    });

    socket.on("end", async () => {
      try {
        const lines = data.trim().split("\n");
        const request = JSON.parse(lines[0]);
        const client = await connectMcp();
        const result = await client.callTool({
          name: request.name,
          arguments: request.args ?? {},
        });
        socket.end(JSON.stringify(result));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        socket.end(JSON.stringify({ error: msg }));
        // If MCP connection failed, reset it
        if (mcpClient) {
          try { await mcpClient.close(); } catch { /* ignore */ }
          mcpClient = null;
        }
      }
    });

    socket.on("error", () => {
      // client disconnected unexpectedly, ignore
    });
  }

  function cleanupFiles() {
    try { unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
    try { unlinkSync(PID_PATH); } catch { /* ignore */ }
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
