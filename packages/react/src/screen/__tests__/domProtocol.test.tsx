import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ACTIVE_ATTR,
  ANIM_HOLD,
  ANIM_HOLD_ATTR,
  BAR_ACTIVE_ATTR,
  BAR_ATTR,
  BAR_ID_ATTR,
  BAR_ID_TYPE_ATTR,
  BAR_RIDING_ATTR,
  BAR_SPACER_ATTR,
  BAR_STATUS_ATTR,
  BAR_TRANSITION_ATTR,
  FLEMO_ATTRIBUTES,
  PART_NAME_ATTR,
  ROUTER_ATTR,
  SCREEN_ATTR,
  STATUS_ATTR,
  TRANSITION_ATTR,
  attrSelector,
  attrValueSelector,
  type TransitionName
} from "@flemo/core";

import Part from "@screen/Part";
import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

import RouterIdContext from "../../RouterIdContext";

// The binding's half of the DOM protocol.
//
// @flemo/core's own suite proves core writes no raw `data-flemo-*` literal.
// This one proves the BINDING renders exactly the names core's table declares —
// the direction that matters most, because the binding is where the attributes
// are born: JSX prop names are not symbols, so nothing else here can catch a
// typo, a stale name, or an attribute that quietly stopped being rendered.

let stores: FlemoStores;

beforeEach(() => {
  stores = createTestStores();
  stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
  stores.history.setState({ index: 0, histories: [] });
});

const harness = (): ((props: PropsWithChildren) => ReactNode) => {
  const screen: ScreenContextProps = {
    id: "screen-1",
    isActive: true,
    isRoot: true,
    isPrev: false,
    zIndex: 0,
    pathname: "/posts/1",
    params: { id: "1" },
    transitionName: "cupertino" as TransitionName,
    prevTransitionName: "cupertino" as TransitionName,
    routePath: "/posts/:id"
  };
  return function Harness({ children }: PropsWithChildren): ReactNode {
    return createElement(
      StoreContext.Provider,
      { value: stores },
      createElement(
        RouterIdContext.Provider,
        { value: "root" },
        createElement(ScreenContext.Provider, { value: screen }, children)
      )
    );
  };
};

const renderScreen = () =>
  render(
    <Screen
      sharedTopBar={<div>top</div>}
      sharedTopBarId="header"
      sharedBottomBar={<div>bottom</div>}
      sharedBottomBarId={7}
    >
      <Part name="title">title</Part>
    </Screen>,
    { wrapper: harness() }
  );

describe("the rendered DOM protocol", () => {
  it("renders the screen attributes core declares", () => {
    const { container } = renderScreen();

    const screen = container.querySelector(attrSelector(SCREEN_ATTR));
    expect(screen).not.toBeNull();
    for (const attribute of [STATUS_ATTR, ACTIVE_ATTR, TRANSITION_ATTR, ANIM_HOLD_ATTR]) {
      expect(screen!.hasAttribute(attribute)).toBe(true);
    }
    // At rest the hold is released. The value vocabulary is shared with the
    // compiled stylesheet, so the string matters as much as the name does.
    expect(screen!.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.RELEASED);
  });

  it("renders both shared bars with their own status/active pair and their id type", () => {
    const { container } = renderScreen();

    const bars = container.querySelectorAll(attrSelector(BAR_ATTR));
    expect(bars.length).toBe(2);
    for (const bar of bars) {
      for (const attribute of [
        BAR_STATUS_ATTR,
        BAR_ACTIVE_ATTR,
        BAR_RIDING_ATTR,
        BAR_TRANSITION_ATTR,
        BAR_ID_ATTR,
        BAR_ID_TYPE_ATTR
      ]) {
        expect(bar.hasAttribute(attribute)).toBe(true);
      }
    }
    // The id's `typeof` travels with it so 7 and "7" never match as one bar.
    const bottom = container.querySelector(attrValueSelector(BAR_ATTR, "nav"))!;
    expect(bottom.getAttribute(BAR_ID_TYPE_ATTR)).toBe("number");

    expect(container.querySelectorAll(attrSelector(BAR_SPACER_ATTR)).length).toBe(2);
  });

  it("gives a <Part> its name plus the screen's status/active, so both sides can find it", () => {
    const { container } = renderScreen();

    const part = container.querySelector(attrSelector(PART_NAME_ATTR))!;
    expect(part).not.toBeNull();
    expect(part.getAttribute(PART_NAME_ATTR)).toBe("title");
    for (const attribute of [STATUS_ATTR, ACTIVE_ATTR, ROUTER_ATTR]) {
      expect(part.hasAttribute(attribute)).toBe(true);
    }
  });

  it("renders no data-flemo-* attribute core's table does not declare", () => {
    const { container } = renderScreen();
    const declared = new Set<string>(FLEMO_ATTRIBUTES);
    const undeclared = new Set<string>();
    for (const element of container.querySelectorAll("*")) {
      for (const attribute of element.getAttributeNames()) {
        if (!attribute.startsWith("data-flemo-")) continue;
        if (!declared.has(attribute)) undeclared.add(attribute);
      }
    }
    expect([...undeclared].sort()).toEqual([]);
  });
});
