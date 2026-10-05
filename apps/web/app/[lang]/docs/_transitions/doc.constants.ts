// Moving between doc pages on a wide screen: the sidebar holds still and only
// the page swaps, so the move is small, a short rise and a fade, and quick
// enough to read as a page turn rather than a journey. On a phone the docs push
// with cupertino instead (see useDocsNavigate), so a reader can swipe back.
export const DOC_OFFSET = "14px";

export const DOC_EASE = [0.2, 0.8, 0.2, 1] as const;

export const DOC_DURATION = 0.3;
