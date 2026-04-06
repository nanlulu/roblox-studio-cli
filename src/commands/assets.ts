import type { Command } from "commander";
import { callToolSmart as callTool } from "../smart-client.js";
import { extractText, extractJSON } from "../formatters/index.js";
import { output } from "../output.js";

export function registerAssetCommands(program: Command) {
  program
    .command("mesh <prompt>")
    .description("Generate a 3D mesh from a text prompt")
    .action(async (prompt: string) => {
      const result = await callTool("generate_mesh", { prompt });

      if (program.opts().json) {
        output(JSON.stringify(extractJSON(result), null, 2));
        return;
      }

      output(extractText(result));
    });

  program
    .command("material <prompt>")
    .description("Generate a material/texture from a text prompt")
    .action(async (prompt: string) => {
      const result = await callTool("generate_material", { prompt });

      if (program.opts().json) {
        output(JSON.stringify(extractJSON(result), null, 2));
        return;
      }

      output(extractText(result));
    });

  program
    .command("store <query>")
    .description("Insert an asset from the Creator Store")
    .action(async (query: string) => {
      const result = await callTool("insert_from_creator_store", { query });

      if (program.opts().json) {
        output(JSON.stringify(extractJSON(result), null, 2));
        return;
      }

      output(extractText(result));
    });
}
