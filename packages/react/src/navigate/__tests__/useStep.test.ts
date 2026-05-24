import { describe, it } from "vitest";

// `useStep` (pushStep / replaceStep / popStep) depends on `useScreen()`
// — provided by the Router → Renderer → Screen tree — and on the Screen
// param-dispatch context. Testing these requires either a full Router mount
// (heavier setup, also needs HistoryListener wired to consume popstate) or
// a focused harness that mocks `useScreen` and the dispatch context.
//
// Until that harness lands, the surface is stubbed here so the gap is
// visible in the test report. The underlying TaskManager serialization
// guarantees push/replace/pop FIFO ordering already, so the missing tests
// are about *step-vs-screen* semantics: pushStep should rewrite the
// browser-history entry to step:true and push a new step entry; replaceStep
// should only mutate the current entry's state; popStep should distinguish
// a step boundary from a screen boundary via the popstate state shape.

describe("useStep — pending harness (TODO)", () => {
  it.todo("pushStep adds a step-tagged history entry without bumping the screen index");
  it.todo("replaceStep mutates the current step entry's params in-place");
  it.todo("popStep handling a step-only popstate dispatches params, leaves history index");
  it.todo("popStep crossing a step boundary triggers a screen pop (status POPPING)");
  it.todo("pushStep then replaceStep then popStep drains in FIFO order");
});
