import type { Command } from "commander";
import { callToolSmart as callTool } from "../smart-client.js";
import { extractJSON, formatFlatTree } from "../formatters/index.js";
import { output } from "../output.js";

function formatInspect(obj: Record<string, unknown>): string {
  // Handle multiple matches
  if (obj.matches && Array.isArray(obj.matches)) {
    const note = obj.note ? `${obj.note}\n\n` : "";
    const warning = obj.warning ? `\nWarning: ${obj.warning}\n` : "";
    const items = (obj.matches as Record<string, unknown>[])
      .map((m) => formatInspect(m))
      .join("\n---\n");
    return `${note}${items}${warning}`;
  }

  const lines: string[] = [];
  const name = obj.name ?? obj.Name;
  const className = obj.className ?? obj.ClassName;
  const path = obj.path ?? obj.Path ?? obj.fullPath;

  if (name) lines.push(`Name: ${name}`);
  if (className) lines.push(`Class: ${className}`);
  if (path) lines.push(`Path: ${path}`);

  // Properties
  const props = obj.properties ?? obj.Properties;
  if (props && typeof props === "object") {
    lines.push("\nProperties:");
    for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
      lines.push(`  ${k}: ${JSON.stringify(v)}`);
    }
  }

  // Attributes
  const attrs = obj.attributes ?? obj.Attributes;
  if (attrs && typeof attrs === "object") {
    const attrEntries = Object.entries(attrs as Record<string, unknown>);
    if (attrEntries.length > 0) {
      lines.push("\nAttributes:");
      for (const [k, v] of attrEntries) {
        lines.push(`  ${k}: ${JSON.stringify(v)}`);
      }
    }
  }

  // Children summary
  const children = obj.children ?? obj.Children;
  if (children && typeof children === "object") {
    const ch = children as Record<string, unknown>;
    const count = ch.childrenCount ?? (Array.isArray(ch) ? ch.length : 0);
    const total = ch.totalDescendants;
    const immediate = ch.immediateChildren ?? (Array.isArray(ch) ? ch : null);

    if (count || total) {
      lines.push(`\nChildren (${count}${total ? `, ${total} total descendants` : ""}):`);
    }
    if (Array.isArray(immediate)) {
      for (const child of immediate.slice(0, 20)) {
        const c = child as Record<string, unknown>;
        const cPath = c.path ?? c.Path ?? c.name ?? c.Name ?? "?";
        const cCls = (c.className ?? c.ClassName) ? ` (${c.className ?? c.ClassName})` : "";
        lines.push(`  ${cPath}${cCls}`);
      }
      if (immediate.length > 20) {
        lines.push(`  ... and ${immediate.length - 20} more`);
      }
    }
  }

  return lines.join("\n");
}

export function registerDataModelCommands(program: Command) {
  program
    .command("tree")
    .description("Explore the game instance hierarchy")
    .option("--path <path>", "Filter by path (dot-notation)")
    .option("--type <type>", "Filter by instance type/class")
    .option("--keyword <keyword>", "Filter by keyword")
    .action(async (opts: { path?: string; type?: string; keyword?: string }) => {
      const args: Record<string, unknown> = {};
      if (opts.path) args.path = opts.path;
      if (opts.type) args.instance_type = opts.type;
      if (opts.keyword) args.keywords = opts.keyword;

      const result = await callTool("search_game_tree", args);
      const data = extractJSON(result);

      if (program.opts().json) {
        output(JSON.stringify(data, null, 2));
        return;
      }

      if (Array.isArray(data)) {
        output(formatFlatTree(data));
      } else {
        output(String(data));
      }
    });

  program
    .command("inspect <path>")
    .description("Get detailed info about an instance")
    .action(async (path: string) => {
      const result = await callTool("inspect_instance", { path });
      const data = extractJSON(result);

      if (program.opts().json) {
        output(JSON.stringify(data, null, 2));
        return;
      }

      if (typeof data === "object" && data !== null) {
        output(formatInspect(data as Record<string, unknown>));
      } else {
        output(String(data));
      }
    });
}
