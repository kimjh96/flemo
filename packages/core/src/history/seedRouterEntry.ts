import ensureWindowHistoryState from "@history/ensureWindowHistoryState";

import type { HistoryDriver } from "@history/historyDriver";

import type { TransitionName } from "@transition/typing";

import isServer from "@utils/isServer";

export interface SeedRouterEntryInput {
  // The Router's own (keyed / locale-aware) driver — every read and write of
  // the current entry goes through it.
  driver: HistoryDriver;
  // The key this Router's frames live under in `history.state`; null keeps the
  // legacy bare (keyless) seed a hosted scope uses.
  routerKey: string | null;
  // A nested Router owns only its zone. false for a root Router, which owns the
  // whole surface and never reflects a seed URL.
  nested: boolean;
  // The pathname this Router mounted with (its seed / initPath).
  seedPathname: string;
  defaultTransitionName: TransitionName;
  // The seed entry's params, so a step pop back onto it restores them.
  rootParams: object;
}

// Stamp this Router's identity onto the browser entry it mounted on: seed its
// keyed frame into `history.state` (so a later traversal back onto the entry
// resolves this Router's key) and, for a NESTED Router, reflect the seed path
// in the address bar (the host pushed the zone's bare parent — /playground —
// while the screen actually mounted is /playground/1).
//
// Everything is fenced to the Router's OWN zone. Under a rapid back/forward
// storm this can run AFTER the browser has already traversed to a FOREIGN
// entry (home, another zone); seeding a frame into it — or worse, reflecting
// the seed URL over it — RENAMES that entry: the home entry reading
// /playground/1 in the address bar while the shell correctly shows Home, a
// permanent URL↔content mismatch no convergence can repair, since every frame
// on the entry says it IS home. The fence: the live pathname must be the seed
// itself or the zone's bare parent — and the ROOT path can never be a zone's
// parent (every path starts with "/", so backing to home mid-storm must not
// satisfy the prefix test).
//
// Framework-neutral: a binding calls this from its mount lifecycle (a React
// effect, a Svelte/Solid mount hook) after resolving its driver and key.
export default function seedRouterEntry(input: SeedRouterEntryInput): void {
  const { driver, routerKey, nested, seedPathname, defaultTransitionName, rootParams } = input;
  if (isServer()) return;

  if (nested) {
    const livePathname = driver.readPathname().replace(/\/+$/, "") || "/";
    const zoneIsCurrent =
      livePathname === seedPathname ||
      (livePathname !== "/" && seedPathname.startsWith(`${livePathname}/`));
    if (!zoneIsCurrent) return;
  }

  // Whether the CURRENT entry already carries this Router's frame — read BEFORE
  // the seed below creates one. A remounted Router (its screen re-entered by a
  // traversal) can mount while the browser has already moved further ahead (a
  // queued forward), and the entry under it then belongs to a PREVIOUS
  // incarnation's navigation, not to this fresh seed. Reflecting the seed URL
  // into that entry would corrupt it (a /playground/2 entry renamed to
  // /playground/1 while still carrying the panel-2 frame).
  const entryPredatesThisRouter = nested && routerKey !== null ? driver.readState() == null : false;

  ensureWindowHistoryState(routerKey, defaultTransitionName, rootParams);

  // Reflect the seed path in the address bar. Routed through the driver (not
  // window directly) so a locale-aware driver keeps its URL prefix; the keyed
  // state is preserved. A deep link already matches its seed, so this is a
  // no-op — and an entry a previous incarnation already wrote to is never
  // renamed (see above).
  if (
    nested &&
    routerKey !== null &&
    entryPredatesThisRouter &&
    driver.readPathname() !== seedPathname
  ) {
    driver.replaceState(driver.readState(), seedPathname);
  }
}
