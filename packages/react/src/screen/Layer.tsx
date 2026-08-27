import { type PropsWithChildren } from "react";

import { createPortal } from "react-dom";

import { useLayerHost } from "@screen/LayerHostContext";

export type LayerProps = PropsWithChildren;

/**
 * Render children beside the screen instead of inside it.
 *
 * A screen that is moving carries a transform, which makes it a containing
 * block for `position: fixed` descendants and a stacking context around all of
 * them. So an overlay authored inside a screen travels with that screen and
 * cannot paint above the shared bars, which live outside it — not because of
 * any rule flemo invented, but because a stacking context cannot be
 * interleaved with an element outside it.
 *
 * `<Layer>` moves its children out of that box and into the screen container,
 * after the shared bars. There they anchor to the viewport, paint over the
 * bars, and stay put while the screen slides — and they remain THIS screen's,
 * so a covered screen's overlay is still covered by the screen above it. That
 * last part is what portaling to `document.body` gives up.
 *
 * ```tsx
 * <Screen sharedBottomBar={<TabBar />}>
 *   <Content />
 *   <Layer>
 *     <BottomSheet open={open} />
 *   </Layer>
 * </Screen>
 * ```
 *
 * Children keep whatever positioning they already had; `<Layer>` adds no box
 * and no styles of its own. On the server, and for the first render before the
 * host mounts, it renders nothing.
 */
function Layer({ children }: LayerProps) {
  const host = useLayerHost();

  if (!host) return null;

  return createPortal(children, host);
}

export default Layer;
