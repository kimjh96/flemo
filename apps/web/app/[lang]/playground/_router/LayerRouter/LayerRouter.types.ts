// Routes for the layering fixture. Namespaced under /playground so they never
// collide with the shell's routes in the global route registry.
declare module "@flemo/react" {
  // The nested stack is named so the screen can target it explicitly: an
  // unnamed useNavigate() would resolve to whichever Router is nearest, and
  // this fixture deliberately has two.
  interface RegisterRouter {
    layer: true;
  }

  interface RegisterRoute {
    "/playground/layer": Record<string, never>;
    "/playground/layer/list": Record<string, never>;
    "/playground/layer/detail": Record<string, never>;
  }
}

export {};
