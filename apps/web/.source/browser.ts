// @ts-nocheck
import { browser } from "fumadocs-mdx/runtime/browser";
import type * as Config from "../source.config";

const create = browser<
  typeof Config,
  import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
    DocData: {};
  }
>();
const browserCollections = {
  docs: create.doc("docs", {
    "api.ko.mdx": () => import("../content/docs/api.ko.mdx?collection=docs"),
    "api.mdx": () => import("../content/docs/api.mdx?collection=docs"),
    "getting-started.ko.mdx": () =>
      import("../content/docs/getting-started.ko.mdx?collection=docs"),
    "getting-started.mdx": () => import("../content/docs/getting-started.mdx?collection=docs"),
    "index.ko.mdx": () => import("../content/docs/index.ko.mdx?collection=docs"),
    "index.mdx": () => import("../content/docs/index.mdx?collection=docs"),
    "navigation.ko.mdx": () => import("../content/docs/navigation.ko.mdx?collection=docs"),
    "navigation.mdx": () => import("../content/docs/navigation.mdx?collection=docs"),
    "router.ko.mdx": () => import("../content/docs/router.ko.mdx?collection=docs"),
    "router.mdx": () => import("../content/docs/router.mdx?collection=docs"),
    "screen.ko.mdx": () => import("../content/docs/screen.ko.mdx?collection=docs"),
    "screen.mdx": () => import("../content/docs/screen.mdx?collection=docs"),
    "transitions.ko.mdx": () => import("../content/docs/transitions.ko.mdx?collection=docs"),
    "transitions.mdx": () => import("../content/docs/transitions.mdx?collection=docs")
  })
};
export default browserCollections;
