"use client";

import Button, { ButtonLink } from "@/components/Button";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import useSiteNavigate from "@/app/[lang]/_hooks/useSiteNavigate";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";
import { GITHUB_URL } from "@/lib/i18n";

function HomeCta() {
  const t = useShellDict().home.cta;
  const { drillIntoDocs } = useSiteNavigate();

  return (
    <section className="relative overflow-hidden border-t border-line">
      <div
        aria-hidden="true"
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_80%_at_50%_100%,black,transparent)]"
      />
      <div className="relative mx-auto flex max-w-[1280px] flex-col items-center gap-6 px-4 py-28 text-center sm:px-6 lg:py-36">
        <Logo size={48} />
        <h2 className="max-w-[18ch] text-h1 text-fg">{t.title}</h2>
        <p className="max-w-[44ch] text-lead text-fg-muted">{t.body}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => drillIntoDocs("getting-started")}>
            {t.primary}
            <Icon name="arrowRight" size={16} />
          </Button>
          <ButtonLink
            size="lg"
            variant="secondary"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="github" size={16} />
            {t.secondary}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export default HomeCta;
