import { callTool, type ToolResult } from "./client.js";
import { tryDaemonCall } from "./daemon-client.js";

/**
 * Smart client: tries daemon first, falls back to per-invocation.
 */
export async function callToolSmart(
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  // Try daemon first (fast path)
  const daemonResult = await tryDaemonCall(name, args);
  if (daemonResult) return daemonResult;

  // Fall back to per-invocation
  return callTool(name, args);
}
