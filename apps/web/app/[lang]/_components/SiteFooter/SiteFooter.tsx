"use client";

import Logo from "@/components/Logo";
import useSiteNavigate, { type SectionPath } from "@/app/[lang]/_hooks/useSiteNavigate";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";
import { GITHUB_URL, NPM_URL } from "@/lib/i18n";

const LINK = "text-sm text-fg-muted transition-colors hover:text-fg";

function SiteFooter() {
  const t = useShellDict();
  const { goSection } = useSiteNavigate();

  const sections: { label: string; path: SectionPath }[] = [
    { label: t.nav.docs, path: "/docs" },
    { label: t.nav.playground, path: "/playground" },
    { label: t.nav.showcase, path: "/showcase" }
  ];

  const resources = [
    { label: t.nav.github, href: GITHUB_URL },
    { label: t.footer.npm, href: NPM_URL },
    { label: t.footer.llms, href: "/llms.txt" },
    { label: t.footer.agentSkill, href: `${GITHUB_URL}/tree/main/.agents/skills/flemo` }
  ];

  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto_auto] md:gap-20">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-fg">
            <Logo size={20} />
            <span className="font-semibold tracking-[-0.03em]">flemo</span>
          </span>
          <p className="text-sm text-fg-subtle">{t.footer.tagline}</p>
        </div>
        <nav className="flex flex-col gap-2.5" aria-label={t.footer.product}>
          <span className="label mb-1 text-fg-subtle">{t.footer.product}</span>
          {sections.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => goSection(link.path)}
              className={`text-left ${LINK}`}
            >
              {link.label}
            </button>
          ))}
        </nav>
        <nav className="flex flex-col gap-2.5" aria-label={t.footer.resources}>
          <span className="label mb-1 text-fg-subtle">{t.footer.resources}</span>
          {resources.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={LINK}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto flex max-w-[1280px] items-center justify-between border-t border-line px-4 py-5 text-xs text-fg-subtle sm:px-6">
        <span>{t.footer.license}</span>
        <span className="font-mono">© kimjh96</span>
      </div>
    </footer>
  );
}

export default SiteFooter;
