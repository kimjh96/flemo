import { SURFACE_TOKENS } from "../surface";

// The panel's entire stylesheet, injected once into its shadow root.
//
// NO transitions and NO keyframes anywhere — not even the hover polish the
// design would allow. Reason: a transition can only be suppressed during a
// flight by writing to the DOM (an attribute/class the CSS keys on), and this
// panel is forbidden from writing to the DOM while a flight runs (see
// panel/index.ts). A hover that repaints instantly costs one small composited
// rect; a hover that ANIMATES keeps the main thread busy for 150ms next to
// the transition we are trying to measure. Instant wins.

export const PANEL_CSS = `${SURFACE_TOKENS}
.toggle {
  position: fixed;
  bottom: 12px;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg);
  color: var(--fg);
  font: inherit;
  cursor: pointer;
}
.toggle:hover { background: var(--bg-soft); }
.toggle[data-corner="bottom-right"] { right: 12px; }
.toggle[data-corner="bottom-left"] { left: 12px; }
.mark { font-weight: 700; letter-spacing: 0.04em; }
.count {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  color: var(--fg-dim);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--bad);
}
.dot[hidden] { display: none; }
.panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147482999;
  display: flex;
  flex-direction: column;
  max-width: 100%;
  border-top: 1px solid var(--line);
  background: var(--bg);
  overflow: hidden;
}
.panel[hidden] { display: none; }
.grip {
  flex: 0 0 6px;
  height: 6px;
  background: var(--line);
  cursor: ns-resize;
  touch-action: none;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
}
.env { color: var(--fg-dim); }
.spacer { flex: 1 1 auto; }
.act {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--bg-soft);
  color: var(--fg);
  font: inherit;
  cursor: pointer;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 100%;
}
.chips:empty { display: none; }
.chip {
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-soft);
  color: var(--fg-dim);
  max-width: 100%;
  overflow-wrap: anywhere;
}
/* The verdict reads as prose, not as a tag: it is a sentence about the whole
   session and it is the first thing anybody should read. */
.chip.lead {
  border-color: var(--fg);
  color: var(--fg);
  white-space: normal;
  max-width: 100%;
  line-height: 1.5;
}
.chip.warn { border-color: var(--warn); color: var(--warn); }
.chip.bad { border-color: var(--bad); color: var(--bad); }
.body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}
.list {
  flex: 0 0 40%;
  max-width: 340px;
  min-width: 180px;
  overflow: auto;
  border-right: 1px solid var(--line);
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: none;
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.row[aria-selected="true"] { background: var(--bg-soft); }
.row .kind { font-weight: 700; }
.row .driver { color: var(--accent); }
.row .dur, .row .screens { color: var(--fg-dim); }
.row .n {
  margin-left: auto;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  color: var(--fg-dim);
}
.row .n.bad { background: var(--bad); color: #fff; }
.detail { flex: 1 1 auto; overflow: auto; padding: 8px 10px; }
.section { margin: 0 0 10px; }
.section > h2 {
  margin: 0 0 4px;
  font: inherit;
  font-weight: 700;
  color: var(--fg-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.kv { display: flex; gap: 8px; }
.kv > .k { flex: 0 0 34%; max-width: 180px; color: var(--fg-dim); }
.kv > .v { flex: 1 1 auto; overflow-wrap: anywhere; }
/* A value that IS the finding — a stall, a re-asserted hold, an orphan. */
.kv > .v.bad { color: var(--bad); }
.li { overflow-wrap: anywhere; }
.li.bad { color: var(--bad); }
.dim { color: var(--fg-dim); }
.spark { display: block; width: 100%; height: 28px; }
.foot { border-top: 1px solid var(--line); padding: 6px 10px; color: var(--fg-dim); }
.foot summary { cursor: pointer; }
.foot .li { margin-top: 4px; }
`;
