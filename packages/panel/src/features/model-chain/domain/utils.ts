export function normalizeSlug(value: string): string {
  return value
    .trim()
    .replace(/^--/, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 63);
}
