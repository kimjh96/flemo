"use client";

import { Screen, useNavigate } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import ShowcaseAppCard from "./ShowcaseAppCard";
import { showcaseApps } from "./showcaseApps";
import ShowcaseSubmitCard from "./ShowcaseSubmitCard";

const SUBMIT_URL = "https://github.com/kimjh96/flemo/issues/new";

function ShowcaseScreen() {
  const lang = useShellLang();
  const t = getDict(lang).showcase;
  const navigate = useNavigate();
  const openDemo = () =>
    navigate.push("/playground", {}, { transitionName: "shared-axis-forward" });

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <div className="h-full overflow-y-auto">
        <main className="showcase-page">
          <div className="site-container">
            <p className="site-overline">{t.kicker}</p>
            <div className="showcase-heading">
              <h1 className="site-display-section">{t.title}</h1>
              <p className="site-lead">{t.subtitle}</p>
            </div>

            <div className="showcase-feature-grid">
              {showcaseApps.map((app) => {
                const copy = t.apps[app.id];
                return (
                  <ShowcaseAppCard
                    key={app.id}
                    name={copy.name}
                    tagline={copy.tagline}
                    description={copy.description}
                    flemoUsageLabel={t.flemoUsageLabel}
                    flemoUsage={copy.flemoUsage}
                    languagesLabel={t.languagesLabel}
                    languages={app.languages.map((code) => t.languageNames[code])}
                    logo={app.logo}
                    appStore={
                      app.appStoreUrl ? { label: t.appStore, href: app.appStoreUrl } : undefined
                    }
                    playStore={
                      app.playStoreUrl ? { label: t.playStore, href: app.playStoreUrl } : undefined
                    }
                  />
                );
              })}
              <div className="showcase-side">
                <p className="site-overline">{lang === "ko" ? "직접 체험" : "Try it yourself"}</p>
                <h2>
                  {lang === "ko"
                    ? "화면을 눌러보면 더 빨리 알 수 있어요."
                    : "A tap says more than a screenshot."}
                </h2>
                <button
                  type="button"
                  onClick={openDemo}
                  className="site-button site-button-primary mt-6"
                >
                  {lang === "ko" ? "데모 열기" : "Open the demo"} ↗
                </button>
                <ShowcaseSubmitCard
                  title={t.submit.title}
                  body={t.submit.body}
                  cta={t.submit.cta}
                  href={SUBMIT_URL}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </Screen>
  );
}

export default ShowcaseScreen;
