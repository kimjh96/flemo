import type { LabTransition } from "../../_providers/LabSettingsProvider";

// Route + custom transitions for the full-page playground stage. Paths are
// composed under the shell's /playground route (/playground/:n is a real server
// route), so deep-links and refreshes resolve. The optional `code` is a flemo
// `useStep` param: opening the source panel pushes a history step that carries
// which transition's source to show, so Back/close pops it without leaving.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/playground/:n": { n: string; code?: LabTransition };
  }

  interface RegisterTransition {
    fade: "fade";
    zoom: "zoom";
    blur: "blur";
    reveal: "reveal";
    dive: "dive";
    ripple: "ripple";
    "card-stack": "card-stack";
    spring: "spring";
    wipe: "wipe";
  }

  interface RegisterPartTransition {
    "panel-title": "panel-title";
  }

  interface RegisterDecorator {
    tunnel: "tunnel";
    ripples: "ripples";
  }
}

export {};
