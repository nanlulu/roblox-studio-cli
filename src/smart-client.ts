import { callTool, type ToolResult } from "./client.js";
import { tryDaemonCall } from "./daemon-client.js";
import { ensureDaemon } from "./daemon.js";

/**
 * Smart client: ensures daemon is running, uses it for calls.
 * Falls back to single-shot only if daemon fails.
 */
export async function callToolSmart(
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  // Ensure daemon is running (no-op if already started)
  await ensureDaemon();

  // Try daemon (fast path)
  const daemonResult = await tryDaemonCall(name, args);
  if (daemonResult) return daemonResult;

  // Fall back to per-invocation
  return callTool(name, args);
}
