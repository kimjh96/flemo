import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { Folder, Item, Node, Root } from "fumadocs-core/page-tree";
import type { ReactNode } from "react";

import { baseOptions } from "@/app/layout.config";
import ExperimentalPill from "@/components/ExperimentalPill";
import { source } from "@/lib/source";

const EXPERIMENTAL_URLS = new Set(["/docs/layout-screen", "/ko/docs/layout-screen"]);

function decorateNode(node: Node): Node {
  if (node.type === "page") {
    if (EXPERIMENTAL_URLS.has(node.url)) {
      return { ...node, name: <ExperimentalName>{node.name}</ExperimentalName> } satisfies Item;
    }
    return node;
  }
  if (node.type === "folder") {
    return {
      ...node,
      index: node.index ? (decorateNode(node.index) as Item) : undefined,
      children: node.children.map(decorateNode)
    } satisfies Folder;
  }
  return node;
}

function decorateTree(tree: Root): Root {
  return { ...tree, children: tree.children.map(decorateNode) };
}

function ExperimentalName({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      <ExperimentalPill />
    </span>
  );
}

export default async function Layout({ params, children }: LayoutProps<"/[lang]/docs">) {
  const { lang } = await params;
  const { links: _omitLinks, ...rest } = baseOptions(lang);
  const tree = decorateTree(source.pageTree[lang] ?? source.pageTree.en);

  return (
    <DocsLayout {...rest} links={[]} tree={tree}>
      {children}
    </DocsLayout>
  );
}
