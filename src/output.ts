/**
 * Write output to stdout. Central point for all command output.
 */
export function output(text: string): void {
  process.stdout.write(text + "\n");
}
