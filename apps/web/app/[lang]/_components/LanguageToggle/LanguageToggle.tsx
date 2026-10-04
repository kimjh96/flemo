"use client";

import Icon from "@/components/Icon";
import { useShellLang, useToggleShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { localeNames } from "@/lib/i18n";

// Names the language it switches TO, in that language, so a reader who cannot
// read the current one still finds the way out.
function LanguageToggle() {
  const lang = useShellLang();
  const toggle = useToggleShellLang();
  const target = lang === "ko" ? "en" : "ko";

  return (
    <button
      type="button"
      onClick={toggle}
      lang={target}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      <Icon name="globe" size={15} />
      {localeNames[target]}
    </button>
  );
}

export default LanguageToggle;
