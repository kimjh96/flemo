// WHETHER A BOX CAN BE REVEALED INSTEAD OF LAID OUT.
//
// Where a flight's contents hold (see morphContents), its box is laid out ONCE
// at the size that contains both ends and the near edge is cut back with a
// clip. That is the same picture as the box actually growing only if nothing
// the box paints depends on its size or reaches past its edge.
//
// A list of the things that DO was how this went wrong. It named the shadow
// and the background image after the playground's card lost both for a whole
// flight (measured: inset(0 0 47%) on every frame, the shadow interpolating
// unseen underneath), and a border, an outline, a focus ring, a mask, an
// authored clip-path, a scrollbar, a percentage corner, an ellipsis and a
// pseudo-element were all still waiting behind it. Every one is a property a
// consumer can set, and a list is only as complete as the last one noticed.
//
// So the question is turned round. Every computed property of the arriving
// element is read, and the reveal is allowed only when each one is PROVEN
// harmless: known not to paint against the box, at a value known to paint
// nothing, or at its initial value. A property this table has never heard of,
// set to anything else, is a reason to lay the box out for real. A gap in the
// table costs a layout per frame, which is the path every other flight takes;
// it can never cost a wrong picture.

/** The part of a computed style this reads. */
export type RevealStyle = Pick<CSSStyleDeclaration, "length" | "item" | "getPropertyValue">;

/** `true` where the property never paints against the box; otherwise the test its value must pass. */
type Rule = true | ((value: string) => boolean);

const SAFE = true;

const none = (value: string): boolean => value === "" || value === "none";

/** Every number in the value is zero: a width, or a list of four. */
const zero = (value: string): boolean =>
  value
    .trim()
    .split(/\s+/)
    .every((part) => Number.parseFloat(part) === 0);

/** No length in the value that is not zero; a bare box keyword is zero. */
const noExtent = (value: string): boolean =>
  (value.match(/-?\d*\.?\d+/g) ?? []).every((number) => Number.parseFloat(number) === 0);

/**
 * A percentage corner resolves against the box, and the revealed box is the
 * larger end, so it is the wrong corner at every size but that one.
 */
const noPercent = (value: string): boolean => !value.includes("%");

const clipsOverflow = (value: string): boolean => value === "hidden" || value === "clip";

/** Top-level comma split: a colour function's own commas stay in their layer. */
const layers = (value: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      out.push(value.slice(from, index));
      from = index + 1;
    }
  }
  out.push(value.slice(from));
  return out;
};

/**
 * Whether one computed shadow layer paints anything. Tailwind composes every
 * shadow with four empty ring layers (`rgba(0, 0, 0, 0) 0px 0px 0px 0px`), so a
 * box with no shadow still computes to a list that is not `none`.
 */
const layerPaints = (layer: string): boolean => {
  const text = layer.trim();
  if (text === "" || text === "none" || /\btransparent\b/.test(text)) return false;
  const colour = /[a-z-]+\(([^()]*)\)/.exec(text);
  if (colour) {
    const channels = colour[1]!;
    const slash = channels.split("/");
    const commas = channels.split(",");
    const alpha = slash.length > 1 ? slash[1] : commas.length === 4 ? commas[3] : undefined;
    if (alpha !== undefined && Number.parseFloat(alpha) === 0) return false;
  }
  const lengths = text.replace(/[a-z-]+\([^()]*\)/g, "").match(/-?\d*\.?\d+px/g) ?? [];
  return lengths.some((length) => Number.parseFloat(length) !== 0);
};

const shadowless = (value: string): boolean => !layers(value).some(layerPaints);

const RULES = new Map<string, Rule>();
const rule = (value: Rule, properties: readonly string[]): void => {
  for (const property of properties) RULES.set(property, value);
};

const SIDES = [
  "top",
  "right",
  "bottom",
  "left",
  "block-start",
  "block-end",
  "inline-start",
  "inline-end"
] as const;
const sided = (name: (side: (typeof SIDES)[number]) => string): string[] => SIDES.map(name);

const CORNERS = [
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "border-start-start-radius",
  "border-start-end-radius",
  "border-end-start-radius",
  "border-end-end-radius"
];

// LAYOUT. Where the contents land is what the contents probe measured, and the
// box's own size is the flight's; none of these paint anything themselves.
rule(SAFE, [
  "display",
  "position",
  "float",
  "clear",
  "top",
  "right",
  "bottom",
  "left",
  ...sided((side) => `inset-${side}`),
  "width",
  "height",
  "inline-size",
  "block-size",
  "min-width",
  "min-height",
  "min-inline-size",
  "min-block-size",
  "max-width",
  "max-height",
  "max-inline-size",
  "max-block-size",
  "box-sizing",
  "aspect-ratio",
  ...sided((side) => `margin-${side}`),
  ...sided((side) => `padding-${side}`),
  "flex-basis",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "order",
  "align-content",
  "align-items",
  "align-self",
  "justify-content",
  "justify-items",
  "justify-self",
  "row-gap",
  "column-gap",
  "grid-auto-columns",
  "grid-auto-flow",
  "grid-auto-rows",
  "grid-column-start",
  "grid-column-end",
  "grid-row-start",
  "grid-row-end",
  "grid-template-areas",
  "grid-template-columns",
  "grid-template-rows",
  "vertical-align",
  "z-index",
  "contain",
  "contain-intrinsic-width",
  "contain-intrinsic-height",
  "contain-intrinsic-inline-size",
  "contain-intrinsic-block-size",
  "container-name",
  "container-type",
  "column-count",
  "column-width",
  "column-fill",
  "column-span",
  "break-before",
  "break-after",
  "break-inside",
  "table-layout",
  "border-collapse",
  "caption-side",
  "empty-cells",
  "-webkit-border-horizontal-spacing",
  "-webkit-border-vertical-spacing",
  "list-style-image",
  "list-style-position",
  "list-style-type",
  "counter-increment",
  "counter-reset",
  "counter-set",
  "quotes",
  // Repeats a border or shadow across fragments; each of those is ruled below.
  "box-decoration-break",
  "-webkit-box-align",
  "-webkit-box-direction",
  "-webkit-box-flex",
  "-webkit-box-ordinal-group",
  "-webkit-box-orient",
  "-webkit-box-pack",
  "anchor-name",
  "anchor-scope",
  "position-anchor",
  "position-area",
  "position-try-fallbacks",
  "position-try-order",
  "position-visibility",
  "overflow-anchor",
  "overscroll-behavior-x",
  "overscroll-behavior-y",
  "overscroll-behavior-block",
  "overscroll-behavior-inline",
  "scroll-behavior",
  ...sided((side) => `scroll-margin-${side}`),
  ...sided((side) => `scroll-padding-${side}`),
  "scroll-snap-align",
  "scroll-snap-stop",
  "scroll-snap-type",
  // Only a scrolling box shows a bar, and one is refused outright.
  "scrollbar-color",
  "scrollbar-gutter",
  "scrollbar-width",
  // These shape the content AROUND the box, not the box.
  "shape-outside",
  "shape-margin",
  "shape-image-threshold",
  "field-sizing",
  "reading-flow",
  "reading-order",
  "interpolate-size",
  "zoom"
]);

// TEXT. Glyphs and lines are measured by the contents probe, and their ink is
// clipped by the box's own overflow, which a reveal requires.
rule(SAFE, [
  "color",
  "font-family",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-weight",
  "font-variant-alternates",
  "font-variant-caps",
  "font-variant-east-asian",
  "font-variant-emoji",
  "font-variant-ligatures",
  "font-variant-numeric",
  "font-variant-position",
  "font-feature-settings",
  "font-variation-settings",
  "font-kerning",
  "font-optical-sizing",
  "font-palette",
  "font-synthesis-small-caps",
  "font-synthesis-style",
  "font-synthesis-weight",
  "font-language-override",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-align-last",
  "text-indent",
  "text-transform",
  "text-decoration-line",
  "text-decoration-style",
  "text-decoration-color",
  "text-decoration-thickness",
  "text-decoration-skip-ink",
  "text-underline-offset",
  "text-underline-position",
  "text-emphasis-style",
  "text-emphasis-color",
  "text-emphasis-position",
  "text-shadow",
  "text-rendering",
  "text-size-adjust",
  "-webkit-text-size-adjust",
  "-webkit-font-smoothing",
  "text-wrap-mode",
  "text-wrap-style",
  "white-space-collapse",
  "word-break",
  "overflow-wrap",
  "line-break",
  "hyphens",
  "hyphenate-character",
  "hyphenate-limit-chars",
  "tab-size",
  "direction",
  "unicode-bidi",
  "writing-mode",
  "text-orientation",
  "text-combine-upright",
  "text-spacing-trim",
  "text-autospace",
  "text-box-trim",
  "text-box-edge",
  "ruby-position",
  "ruby-align",
  "-webkit-locale",
  "-webkit-text-fill-color",
  "-webkit-text-stroke-color",
  "-webkit-text-stroke-width",
  "-webkit-text-security",
  "-webkit-rtl-ordering",
  "orphans",
  "widows",
  "caret-color",
  "paint-order",
  "dominant-baseline",
  "alignment-baseline",
  "baseline-shift",
  "baseline-source",
  "math-depth",
  "math-shift",
  "math-style",
  "speak",
  "initial-letter"
]);

// VECTOR PAINT, inherited by an SVG inside the box: the drawing is measured as a
// child and clipped like one. The box itself is refused if it IS an SVG.
rule(SAFE, [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "marker-start",
  "marker-mid",
  "marker-end",
  "clip-rule",
  "color-interpolation",
  "color-interpolation-filters",
  "color-rendering",
  "shape-rendering",
  "image-rendering",
  "image-orientation",
  "stop-color",
  "stop-opacity",
  "flood-color",
  "flood-opacity",
  "lighting-color",
  "vector-effect",
  "mask-type",
  "buffered-rendering",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "d",
  // Only a replaced element has an object, and one is refused outright.
  "object-fit",
  "object-position",
  "object-view-box"
]);

// SURFACE that is the same at every size, or that paints only alongside a
// property ruled below: a border colour needs a width, a mask position needs
// an image, an outline width needs a style.
rule(SAFE, [
  "background-color",
  "background-attachment",
  "background-clip",
  "background-origin",
  "background-position",
  "background-position-x",
  "background-position-y",
  "background-repeat",
  "background-size",
  "background-blend-mode",
  "border-color",
  "border-style",
  ...sided((side) => `border-${side}-color`),
  ...sided((side) => `border-${side}-style`),
  "border-image-outset",
  "border-image-repeat",
  "border-image-slice",
  "border-image-width",
  "outline-color",
  "outline-offset",
  "outline-width",
  "column-rule-color",
  "column-rule-width",
  "row-rule-color",
  "row-rule-width",
  "mask-clip",
  "mask-composite",
  "mask-mode",
  "mask-origin",
  "mask-position",
  "mask-repeat",
  "mask-size",
  "-webkit-mask-clip",
  "-webkit-mask-composite",
  "-webkit-mask-origin",
  "-webkit-mask-position",
  "-webkit-mask-repeat",
  "-webkit-mask-size",
  "-webkit-mask-box-image-outset",
  "-webkit-mask-box-image-repeat",
  "-webkit-mask-box-image-slice",
  "-webkit-mask-box-image-width",
  "opacity",
  "mix-blend-mode",
  "isolation",
  "visibility",
  "color-scheme",
  "accent-color",
  "forced-color-adjust",
  "print-color-adjust",
  "-webkit-print-color-adjust",
  "dynamic-range-limit",
  "-webkit-tap-highlight-color"
]);

// INTERACTION, which paints nothing.
rule(SAFE, [
  "cursor",
  "pointer-events",
  "user-select",
  "-webkit-user-select",
  "-webkit-user-drag",
  "-webkit-user-modify",
  "touch-action",
  "interactivity"
]);

// THE FLIGHT'S OWN: it writes these for its frames, or they only matter on a
// transform or a path ruled below.
rule(SAFE, [
  "animation-composition",
  "animation-delay",
  "animation-direction",
  "animation-duration",
  "animation-fill-mode",
  "animation-iteration-count",
  "animation-name",
  "animation-play-state",
  "animation-timing-function",
  "animation-timeline",
  "animation-range-start",
  "animation-range-end",
  "transition-behavior",
  "transition-delay",
  "transition-duration",
  "transition-property",
  "transition-timing-function",
  "will-change",
  "view-transition-name",
  "view-transition-class",
  "timeline-scope",
  "scroll-timeline-axis",
  "scroll-timeline-name",
  "view-timeline-axis",
  "view-timeline-inset",
  "view-timeline-name",
  "transform-origin",
  "transform-box",
  "transform-style",
  "backface-visibility",
  "perspective-origin",
  "offset-anchor",
  "offset-distance",
  "offset-position",
  "offset-rotate"
]);

// WHAT PAINTS AGAINST THE BOX, allowed only at a value that paints nothing.
//
// - An image, a mask, a border image or a reflection is laid out against the
//   box, so a gradient spreads over the larger end instead of the part shown.
// - A clip-path of the author's own would be replaced by the reveal's.
// - A filter or a backdrop filter reaches past the edge and samples across it.
// - A transform, a path or a perspective turns about an origin the box
//   resolves, and the revealed box is the wrong size to resolve it.
rule(none, [
  "background-image",
  "border-image-source",
  "mask-image",
  "-webkit-mask-image",
  "mask-border-source",
  "-webkit-mask-box-image-source",
  "-webkit-box-reflect",
  "clip-path",
  "filter",
  "backdrop-filter",
  "-webkit-backdrop-filter",
  "transform",
  "translate",
  "rotate",
  "scale",
  "perspective",
  "offset-path",
  // A clamp hides lines behind an ellipsis the box's height decides.
  "-webkit-line-clamp",
  // A native widget draws itself to the box it is given.
  "appearance",
  "-webkit-appearance",
  // The resizer is drawn in the box's corner.
  "resize"
]);
// A shadow paints outside the border box, and the clip removes everything there.
rule(shadowless, ["box-shadow"]);
// A border and a rule paint along the edge the clip moves.
rule(zero, ["border-width", ...sided((side) => `border-${side}-width`)]);
rule((value) => value === "none" || value === "hidden", ["column-rule-style", "row-rule-style"]);
// An outline, a focus ring among them, paints outside the border box.
rule(none, ["outline-style"]);
rule(noPercent, ["border-radius", ...CORNERS]);
// A scrolling box draws a bar against its edge; a visible one lets its contents
// paint past the edge, which the clip would cut.
rule(clipsOverflow, ["overflow", "overflow-x", "overflow-y", "overflow-block", "overflow-inline"]);
rule(noExtent, ["overflow-clip-margin"]);
// An ellipsis is placed at the edge the box's width decides.
rule((value) => value === "clip", ["text-overflow"]);
// Content on the box itself replaces the box with an image.
rule((value) => value === "normal" || value === "none", ["content"]);
rule((value) => value === "visible", ["content-visibility"]);
rule((value) => value === "auto", ["clip"]);

/** Whether a property has a rule. Every paint channel must, so a new one is decided when it is added. */
export const revealRules = (property: string): boolean => RULES.has(property);

const XHTML = "http://www.w3.org/1999/xhtml";

/** Elements whose own content is drawn to the box they are given. */
const REPLACED = new Set([
  "img",
  "video",
  "audio",
  "canvas",
  "iframe",
  "object",
  "embed",
  "input",
  "textarea",
  "select",
  "meter",
  "progress"
]);

/** Enough of a subtree to be sure, and a stop so a page-sized morph cannot walk the document. */
const LIMIT = 256;

/**
 * Initial values, read once per document and text colour: several initial
 * values are `currentcolor`, and they resolve against the box's own colour.
 */
const initials = new WeakMap<Document, Map<string, Map<string, string>>>();

const initialValues = (element: Element, color: string, view: Window): Map<string, string> => {
  const document = element.ownerDocument;
  const byColor = initials.get(document) ?? new Map<string, Map<string, string>>();
  const known = byColor.get(color);
  if (known) return known;
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "all: initial; display: none";
  probe.style.color = color;
  (document.body ?? document.documentElement).appendChild(probe);
  const values = new Map<string, string>();
  try {
    const style = view.getComputedStyle(probe);
    for (let index = 0; index < style.length; index += 1) {
      const property = style.item(index);
      values.set(property, style.getPropertyValue(property));
    }
  } finally {
    probe.remove();
  }
  byColor.set(color, values);
  initials.set(document, byColor);
  return values;
};

const holds = (property: string, value: string, initial: string | undefined): boolean => {
  const found = RULES.get(property);
  if (found === SAFE) return true;
  if (found) return found(value);
  return value === initial;
};

const proven = (
  element: Element,
  style: RevealStyle | null,
  departure: Readonly<Record<string, string>>
): boolean => {
  const view = element.ownerDocument.defaultView;
  if (!style || !view) return false;
  if (element.namespaceURI !== XHTML || REPLACED.has(element.localName)) return false;

  // THE BOX MUST CLIP what is inside it. The reveal's clip cuts at the border
  // box on every side, so contents that paint past it are only the same picture
  // if the box was going to cut them there anyway. Read explicitly, because an
  // unset overflow is at its initial value and would pass the walk below.
  const read = (property: string): string => style.getPropertyValue(property);
  // The shorthand is consulted too, for an engine that reports only it; where
  // the longhands exist the two always agree.
  const [overflowX = "", overflowY = overflowX] = read("overflow").trim().split(/\s+/);
  if (!clipsOverflow(read("overflow-x")) && !clipsOverflow(overflowX)) return false;
  if (!clipsOverflow(read("overflow-y")) && !clipsOverflow(overflowY)) return false;

  // The view is the caller's: it has already refused a style it cannot read,
  // and an element cannot have a computed style without one.
  const initial = initialValues(element, read("color"), view);
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (property.startsWith("--")) continue;
    if (!holds(property, read(property), initial.get(property))) return false;
  }

  for (const [property, value] of Object.entries(departure)) {
    const found = RULES.get(property);
    if (found === undefined || (found !== SAFE && !found(value))) return false;
  }

  // A pseudo-element is a box the contents probe never sees, placed against
  // the box by rules it never reads.
  for (const pseudo of ["::before", "::after"]) {
    const content = view.getComputedStyle(element, pseudo).getPropertyValue("content");
    if (content !== "" && content !== "none" && content !== "normal") return false;
  }

  // The reveal's clip makes the box a BACKDROP ROOT, so a backdrop filter inside
  // it would sample only the box instead of the page behind.
  const descendants = element.querySelectorAll("*");
  if (descendants.length > LIMIT) return false;
  for (const node of descendants) {
    const own = view.getComputedStyle(node);
    if (!none(own.getPropertyValue("backdrop-filter"))) return false;
    if (!none(own.getPropertyValue("-webkit-backdrop-filter"))) return false;
  }
  return true;
};

/**
 * Whether revealing the box draws the same picture as laying it out: the
 * arrival's own `style`, and the `departure`'s paint channels, which are the
 * only way its values reach the arrival (see morphPaint).
 *
 * A style that cannot be read is a style that cannot be proven, so it is laid
 * out for real rather than failing the flight.
 */
export const revealHolds = (
  element: Element,
  style: RevealStyle | null,
  departure: Readonly<Record<string, string>>
): boolean => {
  try {
    return proven(element, style, departure);
  } catch {
    return false;
  }
};
