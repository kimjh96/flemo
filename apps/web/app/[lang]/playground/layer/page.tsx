import type { Metadata } from "next";

import { getDict } from "@/lib/i18n";

import LayerRouter from "../_router/LayerRouter";

// The layering case gets its OWN full-viewport route rather than a card on the
// playground page.
//
// It has to. A `position: fixed` overlay means the viewport, and a stage frame
// inside a scrolling page only means the frame if the frame is transformed — at
// which point the case is measuring a transform it invented, in exactly the
// class of bug it exists to judge. Real geometry, no rounded corners, no
// shadow, no explanatory paragraph over it.
//
// It renders OUTSIDE the site shell, so there is no ShellIntlProvider to read a
// language from. The dictionary is resolved here and handed down instead. The
// browser suite reaches this route unprefixed, which `proxy.ts` rewrites to the
// default language — so the tests keep getting English without knowing that
// this page has a language at all.
export const metadata: Metadata = {
  title: "Overlays",
  robots: { index: false, follow: false }
};

export default async function LayerPage({ params }: PageProps<"/[lang]/playground/layer">) {
  const { lang } = await params;
  const copy = getDict(lang).playground.layer;

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-[var(--color-bg)]"
      data-layer-stage=""
      lang={lang}
    >
      <LayerRouter copy={copy} />
    </main>
  );
}
