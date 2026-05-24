import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // Reuse `full`'s `z.boolean().optional()` shape so we don't have to take
    // a direct dep on zod just to declare one extra frontmatter flag.
    schema: pageSchema.extend({
      beta: pageSchema.shape.full
    })
  }
});

export default defineConfig();
