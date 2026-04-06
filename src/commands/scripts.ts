import type { Command } from "commander";
import { callToolSmart as callTool } from "../smart-client.js";
import { extractText, extractJSON } from "../formatters/index.js";
import { output } from "../output.js";

export function registerScriptCommands(program: Command) {
  program
    .command("read <path>")
    .description("Read a script by dot-notation path")
    .option("--lines <range>", "Line range, e.g. 10:20")
    .action(async (path: string, opts: { lines?: string }) => {
      const args: Record<string, unknown> = { target_file: path };
      if (opts.lines) {
        const [start, end] = opts.lines.split(":").map(Number);
        if (start) args.start_line = start;
        if (end) args.end_line = end;
      }

      const result = await callTool("script_read", args);

      if (program.opts().json) {
        output(JSON.stringify(extractJSON(result), null, 2));
        return;
      }

      output(extractText(result));
    });

  program
    .command("edit <path>")
    .description("Apply edits to a script")
    .requiredOption("--edits <json>", "JSON array of edits")
    .action(async (path: string, opts: { edits: string }) => {
      let edits: unknown;
      try {
        edits = JSON.parse(opts.edits);
      } catch {
        console.error("Error: --edits must be valid JSON");
        process.exit(1);
      }

      const result = await callTool("multi_edit", { file_path: path, edits });

      if (program.opts().json) {
        output(JSON.stringify(extractJSON(result), null, 2));
        return;
      }

      output(extractText(result));
    });

  program
    .command("search <query>")
    .description("Fuzzy search for scripts by name")
    .action(async (query: string) => {
      const result = await callTool("script_search", { keywords: query });
      const data = extractJSON(result);

      if (program.opts().json) {
        output(JSON.stringify(data, null, 2));
        return;
      }

      if (Array.isArray(data)) {
        if (data.length === 0) {
          output("No scripts found.");
          return;
        }
        const lines = data.map(
          (s: Record<string, unknown>, i: number) =>
            `${i + 1}. ${s.path ?? s.name ?? s}`,
        );
        output(lines.join("\n"));
      } else {
        output(String(data));
      }
    });

  program
    .command("grep <pattern>")
    .description("Search for a pattern across all scripts")
    .action(async (pattern: string) => {
      const result = await callTool("script_grep", { query: pattern });
      const data = extractJSON(result);

      if (program.opts().json) {
        output(JSON.stringify(data, null, 2));
        return;
      }

      if (Array.isArray(data)) {
        if (data.length === 0) {
          output("No matches found.");
          return;
        }
        const lines = data.map(
          (m: Record<string, unknown>) =>
            `${m.path ?? "?"}:${m.line ?? "?"}: ${m.text ?? m.match ?? ""}`,
        );
        output(lines.join("\n"));
      } else {
        output(String(data));
      }
    });
}
