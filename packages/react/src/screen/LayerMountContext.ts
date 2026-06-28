import { createContext } from "react";

// A mount node at the screen's scope level (the transition-animated element),
// OUTSIDE the content-isolation box. <Layer> portals its children here so an
// overlay (sheet, dim, FAB) escapes the isolation box's containing block —
// resolving against the full-screen scope instead of the inset, scrollable
// content box — while still riding the screen's transition. null until the
// Screen mounts (and outside any Screen), where <Layer> renders in place.
const LayerMountContext = createContext<HTMLElement | null>(null);

export default LayerMountContext;
