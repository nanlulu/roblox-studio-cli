import type { Command } from "commander";
import { callToolSmart as callTool } from "../smart-client.js";
import { extractJSON } from "../formatters/index.js";
import { output } from "../output.js";

interface Studio {
  name?: string;
  id?: string;
  active?: boolean;
}

export function registerSessionCommands(program: Command) {
  program
    .command("list")
    .description("List all connected Roblox Studio instances")
    .action(async () => {
      const result = await callTool("list_roblox_studios");
      const data = extractJSON(result);

      if (program.opts().json) {
        output(JSON.stringify(data, null, 2));
        return;
      }

      const studios = Array.isArray(data) ? data : (data as Record<string, unknown>).studios;
      if (!Array.isArray(studios) || studios.length === 0) {
        output("No connected Studios found. Make sure Roblox Studio is running with MCP enabled.");
        return;
      }

      const lines = (studios as Studio[]).map(
        (s, i) =>
          `${i + 1}. ${s.name ?? "Unnamed"} (id: ${s.id ?? "?"})${s.active ? " [active]" : ""}`,
      );
      output(lines.join("\n"));
    });

  program
    .command("use <studioId>")
    .description("Set active Studio instance")
    .action(async (studioId: string) => {
      const result = await callTool("set_active_studio", { studio_id: studioId });
      const data = extractJSON(result);

      if (program.opts().json) {
        output(JSON.stringify(data, null, 2));
        return;
      }

      output(`Active Studio set to: ${studioId}`);
    });
}
