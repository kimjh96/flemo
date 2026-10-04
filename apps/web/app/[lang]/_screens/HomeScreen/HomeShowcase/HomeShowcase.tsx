"use client";

import Image from "next/image";

import Button from "@/components/Button";
import Icon from "@/components/Icon";
import useSiteNavigate from "@/app/[lang]/_hooks/useSiteNavigate";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

function HomeShowcase() {
  const t = useShellDict().home.showcase;
  const { goSection } = useSiteNavigate();

  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:py-20">
        <div className="flex flex-col gap-8 rounded-xl border border-line bg-surface p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5">
            <Image
              src="/shiflo/logo.png"
              alt=""
              width={56}
              height={56}
              className="rounded-lg border border-line"
            />
            <div className="flex max-w-[52ch] flex-col gap-2">
              <span className="label text-fg-subtle">{t.eyebrow}</span>
              <h2 className="text-h2 text-fg">{t.title}</h2>
              <p className="text-body text-fg-muted">{t.body}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => goSection("/showcase")}>
            {t.cta}
            <Icon name="arrowRight" size={15} />
          </Button>
        </div>
      </div>
    </section>
  );
}

export default HomeShowcase;
