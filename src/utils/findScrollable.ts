export default function findScrollable(
  startTarget: EventTarget | null,
  options?: {
    direction?: "y" | "x";
    markerSelector?: string;
    depthLimit?: number;
    verifyByScroll?: boolean;
  }
): { element: HTMLElement | null; hasMarker: boolean } {
  const {
    direction = "x",
    markerSelector = "[data-swipe-at-edge]",
    depthLimit = 24,
    verifyByScroll = false
  } = options ?? {};

  // 시작 노드를 좀 더 안정적으로: composed path 우선
  const start = getStartElement(startTarget);
  if (!start) return { element: null, hasMarker: false };

  // 1) 마커 우선
  const marked = start.closest?.(markerSelector);
  if (marked instanceof HTMLElement) {
    if (
      overflowsAxis(marked, direction) &&
      (!verifyByScroll || canProgrammaticallyScroll(marked, direction))
    ) {
      return { element: marked, hasMarker: true };
    }
  }

  // 2) 얕은 부모 루프
  let element: HTMLElement | null = start;
  let depth = 0;
  while (element && element !== document.body && depth < depthLimit) {
    if (
      overflowsAxis(element, direction) &&
      (!verifyByScroll || canProgrammaticallyScroll(element, direction))
    ) {
      return { element: element, hasMarker: false };
    }
    element = element.parentElement;
    depth++;
  }

  return { element: null, hasMarker: false };
}

function getStartElement(event: EventTarget | null): HTMLElement | null {
  if (!event) return null;
  // PointerEvent/TouchEvent 모두 대응
  const anyEvt = event as unknown as Event;
  const path: EventTarget[] | undefined =
    typeof anyEvt.composedPath === "function" ? anyEvt.composedPath() : undefined;
  if (path && path.length) {
    for (const node of path) {
      if (node instanceof HTMLElement) return node;
    }
  }
  return event as HTMLElement | null;
}

/** 내용이 넘치는지(서브픽셀 보정) */
export function overflowsAxis(element: HTMLElement, direction: "y" | "x"): boolean {
  if (direction === "y") {
    return element.scrollHeight - element.clientHeight > 1;
  } else {
    return element.scrollWidth - element.clientWidth > 1;
  }
}

/** 실제 스크롤 가능 여부(선택) */
export function canProgrammaticallyScroll(element: HTMLElement, direction: "y" | "x"): boolean {
  if (!overflowsAxis(element, direction)) return false;

  if (direction === "y") {
    const prev = element.scrollTop;
    element.scrollTop = prev + 1;
    const changedPlus = element.scrollTop !== prev;
    if (changedPlus) {
      element.scrollTop = prev;
      return true;
    }
    element.scrollTop = prev - 1;
    const changedMinus = element.scrollTop !== prev;
    element.scrollTop = prev;
    return changedMinus;
  } else {
    const prev = element.scrollLeft;
    element.scrollLeft = prev + 1;
    const changedPlus = element.scrollLeft !== prev;
    if (changedPlus) {
      element.scrollLeft = prev;
      return true;
    }
    element.scrollLeft = prev - 1;
    const changedMinus = element.scrollLeft !== prev;
    element.scrollLeft = prev;
    return changedMinus;
  }
}
