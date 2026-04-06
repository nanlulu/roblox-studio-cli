import type { ToolResult } from "../client.js";

/**
 * Extract plain text from an MCP tool result.
 * Handles the content[] array and returns just the text.
 */
export function extractText(result: ToolResult): string {
  if (result.isError) {
    const msg = result.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n");
    throw new Error(msg || "Unknown MCP error");
  }

  return result.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n");
}

/**
 * Try to parse text content as JSON, return parsed or raw text.
 * Handles responses that have a prefix note before the JSON (e.g. "Note: ...\n\n[{...}]").
 */
export function extractJSON(result: ToolResult): unknown {
  const text = extractText(result);
  try {
    return JSON.parse(text);
  } catch {
    // Try to find JSON array or object embedded in text
    const jsonStart = text.search(/[\[{]/);
    if (jsonStart > 0) {
      const jsonPart = text.slice(jsonStart);
      try {
        return JSON.parse(jsonPart);
      } catch {
        // fall through
      }
    }
    return text;
  }
}
