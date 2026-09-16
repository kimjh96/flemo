// ROUTER OWNERSHIP (20 points, critical)
//
// "Local navigation changes only the contained stack; ancestor-targeted
// navigation changes only the app stack."
//
// The heaviest criterion in the rubric, because it is the one a plausible
// implementation gets wrong without looking wrong: a panel that pushes onto the
// app's stack still animates, still shows the right screen, and only reveals
// itself when the header slides away with it or when back leaves the app
// instead of the panel.
//
// Both halves are read the same way. Each Router publishes its identity on
// every screen it owns, so a scope is a set of screens with one identity, and
// an action is attributed by comparing every scope's stack before and after it:
// the one that was supposed to move must move, and the one that was not must be
// byte-identical, including which screen is its top.

import { act, pop, scopeOf, settled, signature, stacks } from "../drive.mjs";
import { resolve } from "../contract.mjs";

export const id = "router-ownership";

// The roles this criterion needs to be exposed before it can start, so a
// submission that never marked them fails as that rather than as a timeout.
export const needs = [
  "app-home",
  "local-list",
  "local-filter",
  "open-detail-from-local",
  "shared-action"
];

const describe = (before, after) => {
  const ids = new Set([...Object.keys(before.scopes), ...Object.keys(after.scopes)]);
  const moved = [];
  for (const scope of ids) {
    if (signature(before, scope) !== signature(after, scope)) moved.push(scope);
  }
  return moved;
};

export const run = async ({ page, map }) => {
  const failures = [];
  const local = resolve(map, "local-list").selector;
  const localScope = await scopeOf(page, local);
  const app = resolve(map, "app-home").selector;
  const appScope = await scopeOf(page, app);

  if (localScope === null) failures.push("no local panel found");
  if (appScope === null) failures.push("no app screen found");
  if (localScope !== null && localScope === appScope) {
    // One scope means the panel is not a Router of its own: its list and filter
    // views are pushed onto the app's stack, which is the failure this
    // criterion exists for even when the animation looks right.
    failures.push("the local panel and the app share one Router");
    return { pass: false, failures, detail: { localScope, appScope } };
  }

  // ANCESTOR-TARGETED NAVIGATION FIRST. The link that opens the outer screen
  // lives on the panel's own list view, so it is exercised while the panel is
  // still showing it: the local half below is what moves the panel away, and
  // the contract names no control for bringing it back.
  const beforeApp = await stacks(page);
  const localTopBefore = beforeApp.scopes[localScope]?.top ?? null;
  await act(page, map, "open-detail-from-local");
  const afterApp = await stacks(page);
  const movedByApp = describe(beforeApp, afterApp);
  if (!movedByApp.includes(appScope)) failures.push("the link in the panel opened no app screen");
  const localTopAfter = afterApp.scopes[localScope]?.top ?? null;
  if (localTopBefore !== null && localTopAfter !== null && localTopBefore !== localTopAfter) {
    failures.push("the link in the panel also moved the panel's own stack");
  }
  const detailVisible = await page.locator(resolve(map, "app-detail").selector).first().isVisible();
  if (!detailVisible) failures.push("the app detail screen is not showing after the link");

  await pop(page, map);

  // LOCAL NAVIGATION. The panel's own control, which must move the panel and
  // nothing else, including the address bar: the prompts ask for a panel
  // history that is memory-only and independent of the URL.
  const beforeLocal = await stacks(page);
  await act(page, map, "local-filter");
  const afterLocal = await stacks(page);
  const movedByLocal = describe(beforeLocal, afterLocal);
  if (!movedByLocal.includes(localScope)) failures.push("the local control moved no local stack");
  for (const scope of movedByLocal) {
    if (scope !== localScope) failures.push(`the local control also moved scope ${scope}`);
  }
  if (afterLocal.url !== beforeLocal.url) {
    failures.push(`the local control changed the address bar (${afterLocal.url})`);
  }

  await settled(page);
  return {
    pass: failures.length === 0,
    failures,
    detail: { localScope, appScope, movedByLocal, movedByApp }
  };
};
