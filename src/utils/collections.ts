/**
 * Groups items by a string key.
 *
 * @param items - Items to group.
 * @param getKey - Function returning the group key.
 * @returns A map of grouped items.
 */
export function groupBy<TItem>(
  items: readonly TItem[],
  getKey: (item: TItem) => string
): Map<string, TItem[]> {
  const grouped = new Map<string, TItem[]>();

  for (const item of items) {
    const key = getKey(item);
    const existing = grouped.get(key);

    if (existing === undefined) {
      grouped.set(key, [item]);
      continue;
    }

    existing.push(item);
  }

  return grouped;
}
