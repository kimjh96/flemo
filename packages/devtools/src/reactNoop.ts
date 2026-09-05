import type { FlemoDevtoolsProps } from "./react";

// The PRODUCTION resolution of `@flemo/devtools/react`.
//
// A component that renders null and imports nothing else, so an app can leave
// `<FlemoDevtools />` in its tree and ship it: the recorder, the panel and the
// readout never enter the graph, and no consumer has to remember a guard.
// That forgetting is not hypothetical — it is how this project's own site put
// the real panel into a public chunk twice.
//
// `react` is not imported here either. A function returning null is a valid
// component, and this file is meant to cost nothing at all.

export type { FlemoDevtoolsProps } from "./react";

export function FlemoDevtools(_props: FlemoDevtoolsProps = {}): null {
  return null;
}

export default FlemoDevtools;
