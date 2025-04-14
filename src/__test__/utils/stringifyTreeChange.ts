import stripAnsi from "strip-ansi";
import type { TreeChange } from "../../TreeChange";

export default function stringifyTreeChange(t: TreeChange) {
  return stripAnsi(t.toString());
}
