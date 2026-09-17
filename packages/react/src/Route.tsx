import { type ReactNode } from "react";

import type { Path } from "path-to-regexp";

/**
 * The route registry every navigation is typed against. Augment it once and
 * `push("/posts/:id", { id })` type-checks its path AND its params:
 *
 * ```ts
 * declare module "@flemo/react" {
 *   interface RegisterRoute {
 *     "/posts/:id": { id: string };
 *     "/settings": undefined;
 *   }
 * }
 * ```
 *
 * Until it is augmented `keyof RegisterRoute` is `never`, so `push` accepts no
 * path at all. It is ONE global registry shared by every Router, so a path can
 * type-check while the Router being navigated is not the one that declares it.
 */
// eslint-disable-next-line
export interface RegisterRoute {}

export interface RouteProps {
  /**
   * The path pattern this route answers to, in `path-to-regexp` syntax. A
   * navigation to a path no Route in the target Router declares mounts nothing.
   */
  path: Path | Path[];
  /** The screen to render, normally a `Screen`. */
  element: ReactNode;
}

/**
 * Declares one route of the enclosing Router.
 *
 * Place these inside the Router's `Slot` when it has one, and directly under
 * the Router otherwise.
 */
function Route({ element }: RouteProps) {
  return element;
}

export default Route;
