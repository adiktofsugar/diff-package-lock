import type { TreeChange } from "./TreeChange";

export default function sortChanges(changes: TreeChange[]) {
  return changes.sort((a, b) => {
    if (a.pkg.key === b.pkg.key) {
      return 0;
    }
    return a.pkg.key < b.pkg.key ? -1 : 1;
  });
}
