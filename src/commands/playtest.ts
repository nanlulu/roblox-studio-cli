import type { Command } from "commander";
import { callToolSmart as callTool } from "../smart-client.js";
import { extractText, extractJSON } from "../formatters/index.js";
import { output } from "../output.js";

export function registerPlaytestCommands(program: Command) {
  program
    .command("play [action]")
    .description("Start or stop playtesting (start/stop)")
    .action(async (action?: string) => {
      const isStart = action !== "stop";
      const result = await callTool("start_stop_play", { is_start: isStart });

      if (program.opts().json) {
        output(JSON.stringify(extractJSON(result), null, 2));
        return;
      }

      output(extractText(result));
    });

  program
    .command("console")
    .description("Get console/output logs from playtesting")
    .action(async () => {
      const result = await callTool("get_console_output");
      const data = extractJSON(result);

      if (program.opts().json) {
        output(JSON.stringify(data, null, 2));
        return;
      }

      if (Array.isArray(data)) {
        if (data.length === 0) {
          output("(no console output)");
          return;
        }
        const lines = data.map((entry: Record<string, unknown>) => {
          const source = entry.source ?? entry.messageType ?? "";
          const timestamp = entry.timestamp ?? "";
          const message = entry.message ?? entry.text ?? "";
          return `[${source}] ${timestamp} ${message}`.trim();
        });
        output(lines.join("\n"));
      } else {
        output(String(data));
      }
    });
}
