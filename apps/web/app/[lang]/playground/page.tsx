import type { Metadata } from "next";

import ChainStage from "./_components/ChainStage";
import LayerStage from "./_components/LayerStage";
import PlaygroundStage from "./_components/PlaygroundStage";

// The library's fixture surface, not a marketing page: it exists so a change to
// flemo's motion can be looked at full size, on a production build, instead of
// being judged through a half-covered card in the landing hero.
export const metadata: Metadata = {
  title: "Morph playground",
  robots: { index: false, follow: false }
};

export default function PlaygroundPage() {
  return (
    <>
      <PlaygroundStage />
      <ChainStage />
      <LayerStage />
    </>
  );
}
