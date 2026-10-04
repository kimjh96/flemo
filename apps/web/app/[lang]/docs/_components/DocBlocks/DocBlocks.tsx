"use client";

import Callout from "@/components/Callout";
import CodeBlock from "@/components/CodeBlock";
import { useDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import { headingId } from "../../_data/docPages";
import type { DocBlock } from "../../_data/docTypes";
import DocDemo from "../DocDemo";
import DocDiagram from "../DocDiagram";
import DocDetails from "../DocDetails";
import InlineText from "../InlineText";

export interface DocBlocksProps {
  blocks: DocBlock[];
}

// Renders a page's typed blocks. The same data renders into llms-full.txt, so
// nothing here adds content: it only gives the content its shape.
function DocBlocks({ blocks }: DocBlocksProps) {
  const t = useDict().docs;

  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "p":
            return (
              <p key={index} className="my-4 text-body text-fg/80">
                <InlineText text={block.text} />
              </p>
            );
          case "h": {
            const id = headingId(block.text);
            return (
              <h2
                key={index}
                id={id}
                data-doc-heading=""
                className="group mt-16 mb-4 scroll-mt-24 border-t border-line pt-10 text-h2 text-fg first:mt-0 first:border-t-0 first:pt-0"
              >
                <a href={`#${id}`} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute top-0 -left-6 hidden font-mono text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 lg:inline"
                  >
                    #
                  </span>
                  <InlineText text={block.text} />
                </a>
              </h2>
            );
          }
          case "h3":
            return (
              <h3 key={index} className="mt-9 mb-2 text-h3 text-fg">
                <InlineText text={block.text} />
              </h3>
            );
          case "code":
            return (
              <CodeBlock
                key={index}
                code={block.code}
                lang={block.lang}
                title={block.title}
                highlight={block.highlight}
                className="my-6"
              />
            );
          case "list": {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="relative pl-6 text-body text-fg/80">
                <span
                  aria-hidden="true"
                  className={`absolute left-0 font-mono text-sm ${block.ordered ? "top-[3px] text-fg-subtle" : "top-[0.8em] h-px w-2.5 bg-fg-subtle"}`}
                >
                  {block.ordered ? `${itemIndex + 1}.` : ""}
                </span>
                <InlineText text={item} />
              </li>
            ));
            return block.ordered ? (
              <ol key={index} className="my-5 flex flex-col gap-2.5">
                {items}
              </ol>
            ) : (
              <ul key={index} className="my-5 flex flex-col gap-2.5">
                {items}
              </ul>
            );
          }
          case "note":
            return (
              <div key={index} className="my-6">
                <Callout kind={block.kind} title={block.title}>
                  {block.text.split("\n").map((line, lineIndex) => (
                    <p key={lineIndex} className={lineIndex > 0 ? "mt-2" : ""}>
                      <InlineText text={line} />
                    </p>
                  ))}
                </Callout>
              </div>
            );
          case "table":
            return (
              <div
                key={index}
                className="no-scrollbar my-6 overflow-x-auto rounded-lg border border-line"
              >
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-bg-subtle">
                    <tr>
                      {block.headers.map((header) => (
                        <th
                          key={header}
                          className="label border-b border-line px-4 py-2.5 font-medium whitespace-nowrap text-fg-subtle"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-line last:border-b-0">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={`px-4 py-2.5 align-top text-fg/80 ${cellIndex === 0 ? "whitespace-nowrap" : "min-w-[14rem]"}`}
                          >
                            <InlineText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "demo":
            return <DocDemo key={index} demo={block.demo} caption={block.caption} />;
          case "diagram":
            return <DocDiagram key={index} diagram={block.diagram} caption={block.caption} />;
          case "details":
            return (
              <DocDetails key={index} title={block.title} label={t.details}>
                <DocBlocks blocks={block.blocks} />
              </DocDetails>
            );
        }
      })}
    </>
  );
}

export default DocBlocks;
