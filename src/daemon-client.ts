import { createConnection } from "node:net";
import { existsSync } from "node:fs";
import type { ToolResult } from "./client.js";

const SOCKET_PATH = "/tmp/rbxstudio-daemon.sock";

/**
 * Try to call a tool via the daemon. Returns null if daemon is not running.
 */
export async function tryDaemonCall(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult | null> {
  if (!existsSync(SOCKET_PATH)) return null;

  return new Promise((resolve) => {
    const socket = createConnection(SOCKET_PATH, () => {
      const request = JSON.stringify({ name, args });
      socket.write(request + "\n");
    });

    let data = "";

    socket.on("data", (chunk) => {
      data += chunk.toString();
    });

    socket.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          resolve(null); // fall back to direct call
        } else {
          resolve(parsed as ToolResult);
        }
      } catch {
        resolve(null);
      }
    });

    socket.on("error", () => {
      resolve(null); // daemon not available, fall back
    });

    // Timeout after 30s
    socket.setTimeout(30_000, () => {
      socket.destroy();
      resolve(null);
    });
  });
}
