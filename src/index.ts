import { Command } from "commander";
import { listTools } from "./client.js";
import { callToolSmart } from "./smart-client.js";
import { extractJSON } from "./formatters/index.js";
import { output } from "./output.js";
import { registerSessionCommands } from "./commands/session.js";
import { registerScriptCommands } from "./commands/scripts.js";
import { registerDataModelCommands } from "./commands/datamodel.js";
import { registerAssetCommands } from "./commands/assets.js";
import { registerLuauCommands } from "./commands/luau.js";
import { registerPlaytestCommands } from "./commands/playtest.js";
import { registerInputCommands } from "./commands/input.js";

const program = new Command();

program
  .name("rbxstudio")
  .description("CLI wrapper for Roblox Studio MCP server")
  .version("1.0.0")
  .option("--json", "Output raw JSON instead of formatted text");

// Register all command groups
registerSessionCommands(program);
registerScriptCommands(program);
registerDataModelCommands(program);
registerAssetCommands(program);
registerLuauCommands(program);
registerPlaytestCommands(program);
registerInputCommands(program);

// Raw escape hatch — call any MCP tool directly
program
  .command("raw <toolName> [params]")
  .description("Call any MCP tool directly with JSON params")
  .action(async (toolName: string, params?: string) => {
    let args: Record<string, unknown> = {};
    if (params) {
      try {
        args = JSON.parse(params);
      } catch {
        console.error("Error: params must be valid JSON");
        process.exit(1);
      }
    }

    const result = await callToolSmart(toolName, args);
    output(JSON.stringify(extractJSON(result), null, 2));
  });

// List available MCP tools (debug/discovery)
program
  .command("tools")
  .description("List all available MCP tools from the server")
  .action(async () => {
    const tools = await listTools();
    for (const t of tools) {
      output(`${t.name}${t.description ? ` — ${t.description}` : ""}`);
    }
  });

// Daemon subcommands
const daemon = program
  .command("daemon")
  .description("Manage the background daemon for faster calls");

daemon
  .command("start")
  .description("Start the background daemon")
  .action(async () => {
    const { startDaemon } = await import("./daemon.js");
    await startDaemon();
  });

daemon
  .command("stop")
  .description("Stop the background daemon")
  .action(async () => {
    const { stopDaemon } = await import("./daemon.js");
    await stopDaemon();
  });

daemon
  .command("status")
  .description("Check if the daemon is running")
  .action(async () => {
    const { daemonStatus } = await import("./daemon.js");
    await daemonStatus();
  });

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
