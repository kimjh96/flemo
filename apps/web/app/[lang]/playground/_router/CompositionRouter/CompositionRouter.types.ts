declare module "@flemo/react" {
  interface RegisterRoute {
    "/composition-home": Record<string, never>;
    "/composition-detail/:id": { id: string };
    "/composition-pane-list": Record<string, never>;
    "/composition-pane-filters": Record<string, never>;
  }

  interface RegisterRouter {
    "composition-app": true;
    "composition-pane": true;
  }
}

export {};
