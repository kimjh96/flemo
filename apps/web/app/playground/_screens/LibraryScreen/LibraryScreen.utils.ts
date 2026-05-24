import { segments } from "./LibraryScreen.constants";

import type { Segment } from "./LibraryScreen.types";

export function segmentIndex(key: Segment): number {
  return segments.findIndex((segment) => segment.key === key);
}
