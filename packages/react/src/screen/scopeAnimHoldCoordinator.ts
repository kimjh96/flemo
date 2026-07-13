import {
  createAnimHoldCoordinator,
  type AnimHoldCoordinator,
  type NavigateStoreApi
} from "@flemo/core";

// One anim-hold coordinator per Router scope, keyed by the scope's navigate
// store instance. The navigate store is created once per scope in
// createRouterScope / RouterScopeProvider, is stable for the scope's lifetime,
// and is distinct per scope — a nested Router gets its own, so two scopes
// popping at the same time can never share a pair-release group. Keeping the
// coordinator in a module-level WeakMap (rather than on the FlemoStores context
// value) keeps this pure runtime glue OUT of the public React API and the core
// store bundle: it is created lazily the first time a screen in a scope needs
// it and collected with the store when the scope goes away. See
// createAnimHoldCoordinator in @flemo/core for why a pop releases as a pair.
const coordinators = new WeakMap<NavigateStoreApi, AnimHoldCoordinator>();

export default function getScopeAnimHoldCoordinator(
  navigateStore: NavigateStoreApi
): AnimHoldCoordinator {
  let coordinator = coordinators.get(navigateStore);
  if (!coordinator) {
    coordinator = createAnimHoldCoordinator();
    coordinators.set(navigateStore, coordinator);
  }
  return coordinator;
}
