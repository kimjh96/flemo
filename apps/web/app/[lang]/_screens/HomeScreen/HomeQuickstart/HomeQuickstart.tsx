"use client";

import { useState } from "react";

import CodeBlock from "@/components/CodeBlock";
import SectionHeading from "@/components/SectionHeading";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

const CODE = `import { Route, Router, Screen, useNavigate } from "@flemo/react";

export default function App() {
  return (
    <Router>
      <Route path="/" element={<Home />} />
      <Route path="/places/:id" element={<Place />} />
    </Router>
  );
}

function Home() {
  const navigate = useNavigate();

  return (
    <Screen>
      <button
        onClick={() =>
          navigate.push(
            "/places/:id",
            { id: "kyoto" },
            { transitionName: "material" }
          )
        }
      >
        Kyoto
      </button>
    </Screen>
  );
}`;

// Which lines each point is about. Hovering, focusing or tapping a point lights
// them up in the code.
const LINES = [
  [5, 6, 7, 8],
  [16, 28],
  [19, 20, 21, 22, 23]
];

function HomeQuickstart() {
  const t = useShellDict().home.quickstart;
  const [active, setActive] = useState(0);

  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-32">
        <div className="flex flex-col gap-10">
          <SectionHeading eyebrow={t.eyebrow} title={t.title} body={t.body} />
          <ol className="flex flex-col">
            {t.points.map((point, index) => (
              <li key={point.title}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                  className={`grid w-full grid-cols-[2rem_1fr] gap-x-3 border-l py-4 pl-5 text-left transition-colors ${
                    active === index ? "border-accent" : "border-line hover:border-line-strong"
                  }`}
                >
                  <span
                    className={`pt-0.5 font-mono text-sm ${active === index ? "text-accent" : "text-fg-subtle"}`}
                  >
                    0{index + 1}
                  </span>
                  <span className="text-h3 text-fg">{point.title}</span>
                  <span />
                  <span className="mt-1 text-sm text-fg-muted">{point.body}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <CodeBlock
          code={CODE}
          lang="tsx"
          title="App.tsx"
          highlight={LINES[active]}
          className="self-start shadow-overlay"
        />
      </div>
    </section>
  );
}

export default HomeQuickstart;
