import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { callToolSmart as callTool } from "../smart-client.js";
import { extractText, extractJSON } from "../formatters/index.js";
import { output } from "../output.js";

export function registerLuauCommands(program: Command) {
  program
    .command("exec [code]")
    .description("Execute Luau code in Studio")
    .option("--file <path>", "Read code from a file instead")
    .action(async (code: string | undefined, opts: { file?: string }) => {
      let luauCode: string;

      if (opts.file) {
        try {
          luauCode = readFileSync(opts.file, "utf-8");
        } catch (err) {
          console.error(`Error: Cannot read file: ${opts.file}`);
          process.exit(1);
        }
      } else if (code) {
        luauCode = code;
      } else {
        console.error("Error: Provide code as argument or use --file");
        process.exit(1);
      }

      const result = await callTool("execute_luau", { code: luauCode });

      if (program.opts().json) {
        output(JSON.stringify(extractJSON(result), null, 2));
        return;
      }

      output(extractText(result));
    });
}
