import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createNavigateStore from "@navigate/store";

import { compileTransitionStyles } from "@transition/compileTransitionStyles";
import createTransition from "@transition/createTransition";

import none from "@transition/none";
import resolveTransition from "@transition/resolveTransition";

import { transitionMap } from "@transition/transition";

import { resetDevWarningsForTesting } from "@utils/devWarn";

import { ACTIVE_ATTR, SCREEN_ATTR, STATUS_ATTR, TRANSITION_ATTR } from "@dom/attributes";
import attachMorph from "@morph/attachMorph";
import { registerMorphLayer } from "@morph/morphLayer";
import { morphTransitionMap } from "@transition/morphTransition/morphTransition";

import {
  partTransitionMap,
  resolvePartDefinition
} from "@transition/partTransition/partTransition";

// A NAME THAT RESOLVES TO NOTHING SHOULD SAY SO.
//
// Every registry here is keyed by a name a consumer writes, and every lookup
// was total: a miss fell back to something inert and said nothing. So a typo,
// a forgotten `<Router transitions={...}>` entry, or a name built from data
// with a case nobody added produced an element that sits perfectly still while
// the DOM says everything is fine.
//
// It cost a day: the playground asked for a part transition named
// `chrome-tether`, the table that generates them had no row for it, and the
// detail's header appeared instead of animating. The attribute was on the
// element and the name was spelled right.

// The diagnostic's destination IS the console, so the suite reads it there.
// eslint-disable-next-line no-console
const reported = () => console.error as ReturnType<typeof vi.fn>;

const said = () => reported().mock.calls.map((call) => String(call[0]));

const store = createNavigateStore();

const rect = (element: HTMLElement, x: number, y: number, width: number, height: number) => {
  element.getBoundingClientRect = () =>
    ({
      x,
      y,
      left: x,
      top: y,
      width,
      height,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({})
    }) as DOMRect;
};

const screenOf = (active: boolean) => {
  const screen = document.createElement("div");
  screen.setAttribute(SCREEN_ATTR, "");
  screen.setAttribute(TRANSITION_ATTR, "cupertino");
  screen.setAttribute(STATUS_ATTR, "COMPLETED");
  screen.setAttribute(ACTIVE_ATTR, active ? "true" : "false");
  rect(screen, 0, 0, 400, 800);
  document.body.appendChild(screen);
  return screen;
};

const morphIn = (screen: HTMLElement) => {
  const element = document.createElement("div");
  screen.appendChild(element);
  rect(element, 10, 20, 80, 80);
  return element;
};

describe("an unregistered name", () => {
  beforeEach(() => {
    resetDevWarningsForTesting();
    vi.spyOn(console, "error").mockImplementation(() => {});
    transitionMap.clear();
    partTransitionMap.clear();
    morphTransitionMap.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    transitionMap.clear();
    partTransitionMap.clear();
    morphTransitionMap.clear();
    document.body.innerHTML = "";
  });

  it("says so for a transition, which otherwise reads as one that animates nothing", () => {
    transitionMap.set("none", none);

    const resolved = resolveTransition("typo" as never);

    // Still total: the caller gets `none` and the app keeps working.
    expect(resolved.name).toBe("none");
    expect(said()[0]).toContain('No transition is registered under "typo"');
    expect(said()[0]).toContain("<Router transitions=");
  });

  it("says so for a part, whose element simply never moves", () => {
    partTransitionMap.set(
      "registered" as never,
      {
        name: "registered",
        initial: {},
        variants: {}
      } as never
    );

    expect(resolvePartDefinition("chrome-tether", null)).toBeUndefined();
    expect(said()[0]).toContain('No part transition is registered under "chrome-tether"');
    expect(said()[0]).toContain("<Router partTransitions=");
  });

  it("says so for a decorator a transition names but nobody passed", () => {
    const withOverlay = createTransition({
      name: "with-overlay" as never,
      initial: {},
      idle: { value: {}, options: { duration: 0 } },
      enter: { value: {}, options: { duration: 0.3 } },
      enterBack: { value: {}, options: { duration: 0.3 } },
      exit: { value: {}, options: { duration: 0.3 } },
      exitBack: { value: {}, options: { duration: 0.3 } },
      options: { decoratorName: "overlay" }
    });
    const other = {
      name: "dim",
      initial: { opacity: 0 },
      variants: { "PUSHING-true": { value: { opacity: 1 }, options: { duration: 0.3 } } }
    };

    compileTransitionStyles([withOverlay], [other] as never, []);

    expect(said()[0]).toContain('No decorator is registered under "overlay"');
    expect(said()[0]).toContain("with-overlay");
  });

  it("says so for a morph transition, the quietest of the four", () => {
    // A morph named after nothing still FLIES, on the built-in preset — a
    // shared element that ignores what its author wrote rather than one that
    // stands still, which is the hardest of the four to notice.
    morphTransitionMap.set(
      "registered" as never,
      {
        name: "registered",
        initial: {},
        variants: {}
      } as never
    );
    const layer = document.createElement("div");
    document.body.appendChild(layer);
    registerMorphLayer(store, layer);
    const gallery = screenOf(false);
    const detail = screenOf(true);
    attachMorph(morphIn(gallery), {
      layoutId: "hero",
      name: "typo" as never,
      navigateStore: store
    });
    store.getState().setStatus("PUSHING");
    attachMorph(morphIn(detail), { layoutId: "hero", name: "typo" as never, navigateStore: store });

    expect(
      said().some((line) => line.includes('No morph transition is registered under "typo"'))
    ).toBe(true);
    registerMorphLayer(store, null);
  });

  it("says it once per name, however many times it is looked up", () => {
    transitionMap.set("none", none);

    resolveTransition("typo" as never);
    resolveTransition("typo" as never);
    resolveTransition("typo" as never);

    expect(said()).toHaveLength(1);
  });

  it("says nothing before the Router has registered anything", () => {
    // An empty registry is a render order, not a mistake: the screens resolve
    // their names before the Router's own effect has put them in. Warning
    // there would fire on every correct app, once per name, at startup.
    expect(resolveTransition("cupertino" as never)).toBeUndefined();
    expect(resolvePartDefinition("chrome-tether", null)).toBeUndefined();
    expect(said()).toHaveLength(0);
  });

  it("says nothing for a name that IS registered", () => {
    transitionMap.set("none", none);
    transitionMap.set("real" as never, none);

    expect(resolveTransition("real" as never).name).toBe("none");
    expect(said()).toHaveLength(0);
  });

  it("says nothing where there is no console to say it to", () => {
    // A host with no console is not a host to throw in. The gate reads the
    // global rather than assuming one, and this is the branch that proves it.
    transitionMap.set("none", none);
    const host = globalThis as { console?: Console };
    const real = host.console;
    delete host.console;
    try {
      expect(() => resolveTransition("typo" as never)).not.toThrow();
    } finally {
      host.console = real;
    }
    expect(said()).toHaveLength(0);
  });

  it("stays out of a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      transitionMap.set("none", none);
      resolveTransition("typo" as never);
      expect(said()).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
