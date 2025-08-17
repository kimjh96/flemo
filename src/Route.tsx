import { type ReactNode } from "react";

import type { Path } from "path-to-regexp";

// eslint-disable-next-line
export interface RegisterRoute {}

export interface RouteProps {
  path: Path | Path[];
  element: ReactNode;
}

function Route({ element }: RouteProps) {
  return element;
}

export default Route;
