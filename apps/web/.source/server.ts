// @ts-nocheck
import * as __fd_glob_14 from "../content/docs/transitions.mdx?collection=docs";
import * as __fd_glob_13 from "../content/docs/transitions.ko.mdx?collection=docs";
import * as __fd_glob_12 from "../content/docs/screen.mdx?collection=docs";
import * as __fd_glob_11 from "../content/docs/screen.ko.mdx?collection=docs";
import * as __fd_glob_10 from "../content/docs/router.mdx?collection=docs";
import * as __fd_glob_9 from "../content/docs/router.ko.mdx?collection=docs";
import * as __fd_glob_8 from "../content/docs/navigation.mdx?collection=docs";
import * as __fd_glob_7 from "../content/docs/navigation.ko.mdx?collection=docs";
import * as __fd_glob_6 from "../content/docs/index.mdx?collection=docs";
import * as __fd_glob_5 from "../content/docs/index.ko.mdx?collection=docs";
import * as __fd_glob_4 from "../content/docs/getting-started.mdx?collection=docs";
import * as __fd_glob_3 from "../content/docs/getting-started.ko.mdx?collection=docs";
import * as __fd_glob_2 from "../content/docs/api.mdx?collection=docs";
import * as __fd_glob_1 from "../content/docs/api.ko.mdx?collection=docs";
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs";
import { server } from "fumadocs-mdx/runtime/server";
import type * as Config from "../source.config";

const create = server<
  typeof Config,
  import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
    DocData: {};
  }
>({ doc: { passthroughs: ["extractedReferences"] } });

export const docs = await create.docs(
  "docs",
  "content/docs",
  { "meta.json": __fd_glob_0 },
  {
    "api.ko.mdx": __fd_glob_1,
    "api.mdx": __fd_glob_2,
    "getting-started.ko.mdx": __fd_glob_3,
    "getting-started.mdx": __fd_glob_4,
    "index.ko.mdx": __fd_glob_5,
    "index.mdx": __fd_glob_6,
    "navigation.ko.mdx": __fd_glob_7,
    "navigation.mdx": __fd_glob_8,
    "router.ko.mdx": __fd_glob_9,
    "router.mdx": __fd_glob_10,
    "screen.ko.mdx": __fd_glob_11,
    "screen.mdx": __fd_glob_12,
    "transitions.ko.mdx": __fd_glob_13,
    "transitions.mdx": __fd_glob_14
  }
);
