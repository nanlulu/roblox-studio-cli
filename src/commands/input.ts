import type { Command } from "commander";
import { callToolSmart as callTool } from "../smart-client.js";
import { extractText, extractJSON } from "../formatters/index.js";
import { output } from "../output.js";

export function registerInputCommands(program: Command) {
  program
    .command("nav <target>")
    .description("Move player character to a position or instance")
    .action(async (target: string) => {
      const result = await callTool("character_navigation", { target });

      if (program.opts().json) {
        output(JSON.stringify(extractJSON(result), null, 2));
        return;
      }

      output(extractText(result));
    });

  program
    .command("key <key> <action>")
    .description("Simulate keyboard input (press/release/tap)")
    .option("--duration <ms>", "Duration in milliseconds")
    .action(async (key: string, action: string, opts: { duration?: string }) => {
      const args: Record<string, unknown> = { key, action };
      if (opts.duration) args.duration = parseInt(opts.duration, 10);

      const result = await callTool("user_keyboard_input", args);

      if (program.opts().json) {
        output(JSON.stringify(extractJSON(result), null, 2));
        return;
      }

      output(extractText(result));
    });

  program
    .command("mouse <position> <action>")
    .description("Simulate mouse input (click/move/scroll)")
    .option("--scroll <delta>", "Scroll delta value")
    .action(
      async (position: string, action: string, opts: { scroll?: string }) => {
        const args: Record<string, unknown> = { position, action };
        if (opts.scroll) args.scroll_delta = parseFloat(opts.scroll);

        const result = await callTool("user_mouse_input", args);

        if (program.opts().json) {
          output(JSON.stringify(extractJSON(result), null, 2));
          return;
        }

        output(extractText(result));
      },
    );
}
