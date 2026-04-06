import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const DEFAULT_STUDIO_MCP_MAC =
  "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP";
const DEFAULT_STUDIO_MCP_WIN = "cmd.exe";
const WIN_ARGS = [
  "/c",
  "%LOCALAPPDATA%\\Roblox\\mcp.bat",
];

function getStudioMcpCommand(): { command: string; args: string[] } {
  const custom = process.env.STUDIO_MCP_PATH;
  if (custom) return { command: custom, args: [] };

  if (process.platform === "win32") {
    return { command: DEFAULT_STUDIO_MCP_WIN, args: WIN_ARGS };
  }
  return { command: DEFAULT_STUDIO_MCP_MAC, args: [] };
}

export interface ToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export async function callTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const { command, args: cmdArgs } = getStudioMcpCommand();
  const transport = new StdioClientTransport({ command, args: cmdArgs });
  const client = new Client(
    { name: "rbxstudio-cli", version: "1.0.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({ name, arguments: args });
    return result as ToolResult;
  } finally {
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
  }
}

export async function listTools(): Promise<
  Array<{ name: string; description?: string }>
> {
  const { command, args: cmdArgs } = getStudioMcpCommand();
  const transport = new StdioClientTransport({ command, args: cmdArgs });
  const client = new Client(
    { name: "rbxstudio-cli", version: "1.0.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    const result = await client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
    }));
  } finally {
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
  }
}
