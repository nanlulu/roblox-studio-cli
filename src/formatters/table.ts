/**
 * Format an array of objects as a compact text table.
 */
export function formatTable(
  rows: Record<string, unknown>[],
  columns?: string[],
): string {
  if (rows.length === 0) return "(no results)";

  const cols = columns ?? Object.keys(rows[0]);
  const widths = cols.map((col) =>
    Math.max(
      col.length,
      ...rows.map((r) => String(r[col] ?? "").length),
    ),
  );

  const header = cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");
  const body = rows
    .map((r) =>
      cols.map((c, i) => String(r[c] ?? "").padEnd(widths[i])).join("  "),
    )
    .join("\n");

  return `${header}\n${separator}\n${body}`;
}

/**
 * Format a numbered list of items.
 */
export function formatList(
  items: string[],
  numbered = true,
): string {
  if (items.length === 0) return "(no results)";
  return items
    .map((item, i) => (numbered ? `${i + 1}. ${item}` : `- ${item}`))
    .join("\n");
}
