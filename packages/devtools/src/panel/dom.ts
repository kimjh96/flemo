// Tiny DOM builders for the panel. Deliberately not a framework: this package
// ships zero dependencies and must work in any host app, so the panel is
// hand-built nodes inside a shadow root.
//
// Every text-bearing helper routes through `textContent`. Report data
// (override VALUES, anomaly strings, router ids) originates outside this
// package and is treated as untrusted input — `innerHTML` never appears in
// the panel sources.

const SVG_NS = "http://www.w3.org/2000/svg";

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const svgEl = (tag: string, attributes: Record<string, string>): SVGElement => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
};

/** Empty a container without innerHTML (which would re-parse markup). */
export const clear = (node: Element): void => {
  while (node.firstChild !== null) node.removeChild(node.firstChild);
};

/** Set textContent only when it actually changed — the panel's whole job is
 *  to not churn the DOM more than necessary. */
export const setText = (node: Element, value: string): void => {
  if (node.textContent !== value) node.textContent = value;
};
