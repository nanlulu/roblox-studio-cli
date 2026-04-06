interface TreeNode {
  name?: string;
  Name?: string;
  className?: string;
  ClassName?: string;
  fullPath?: string;
  Path?: string;
  parentName?: string;
  childSummary?: string;
  Children?: TreeNode[];
  [key: string]: unknown;
}

/**
 * Format a flat list of instances from search_game_tree as readable text.
 * Handles both camelCase (actual MCP response) and PascalCase field names.
 */
export function formatFlatTree(
  instances: TreeNode[],
): string {
  if (instances.length === 0) return "(no instances found)";
  return instances
    .map((inst) => {
      const path = inst.fullPath ?? inst.Path ?? inst.name ?? inst.Name ?? "?";
      const cls = (inst.className ?? inst.ClassName) ? ` (${inst.className ?? inst.ClassName})` : "";
      const summary = inst.childSummary ? ` [${inst.childSummary}]` : "";
      return `${path}${cls}${summary}`;
    })
    .join("\n");
}

/**
 * Format a hierarchical tree with indentation.
 */
export function formatTree(nodes: TreeNode[], indent = 0): string {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = "  ".repeat(indent);
    const name = node.name ?? node.Name ?? node.fullPath ?? node.Path ?? "?";
    const cls = (node.className ?? node.ClassName) ? ` (${node.className ?? node.ClassName})` : "";
    lines.push(`${prefix}${name}${cls}`);
    if (node.Children && node.Children.length > 0) {
      lines.push(formatTree(node.Children, indent + 1));
    }
  }
  return lines.join("\n");
}
