// `flemo` is a thin meta package re-exporting `@flemo/react` so existing
// imports (`import { Router, useNavigate, ... } from "flemo"`) keep working
// after the workspace split. Tree-shakers see all symbols as
// re-exports and only retain what the consumer actually uses.
export * from "@flemo/react";
