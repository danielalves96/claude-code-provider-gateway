export function mergeModelLists(value: string[]): string[] {
  const seen = new Set<string>();
  return value.reduce<string[]>((acc, item) => {
    const m = item.trim();
    if (m && !seen.has(m)) {
      seen.add(m);
      acc.push(m);
    }
    return acc;
  }, []);
}

export function stripModelPrefix(displayName: string): string {
  const idx = displayName.indexOf(" · ");
  return idx === -1 ? displayName : displayName.slice(idx + 3);
}
