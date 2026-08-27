import { createContext, useContext } from "react";

// The element `<Layer>` portals into: a childless div rendered as the LAST
// child of the screen container, beside the scope rather than inside it.
//
// Beside is the whole point. A screen that moves on the compositor is a
// stacking context AND a containing block for `position: fixed` descendants —
// that is CSS, not a flemo decision — so anything authored inside the scope
// is one atom with the screen's content as far as the shared bars are
// concerned, and no z-index inside that atom can reach past them. The host is
// a SIBLING of the scope, so a transform, a `will-change`, or containment on
// the scope cannot reach what is portaled here: those only bind descendants.
//
// The host itself therefore carries no transform, no containment and no
// promotion of its own — only the stack position that puts it over the shared
// bars. A `position: fixed` child of it resolves against the viewport, which
// is what a consumer writing `bottom: 0` means.
//
// Null before the screen mounts (and on the server, where the host element
// does not exist yet), so `<Layer>` renders nothing until it has a target.
const LayerHostContext = createContext<HTMLElement | null>(null);

export function useLayerHost() {
  return useContext(LayerHostContext);
}

export default LayerHostContext;
