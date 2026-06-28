"use client";

import { useShellDict } from "@/app/[lang]/(app)/_providers/ShellIntlProvider";

import PhoneFrame from "../_components/PhoneFrame";
import WalletRouter from "../_router/WalletRouter";

// The hero's interactive demo: a phone frame wrapping the wallet's nested
// Router. Replaces the old iframed playground — this runs flemo natively inside
// the shell.
function PlaygroundDemo() {
  const dict = useShellDict();

  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-4">
      <PhoneFrame>
        <WalletRouter />
      </PhoneFrame>
      <p className="text-center text-sm font-medium text-[var(--color-text-secondary)]">
        {dict.home.demoCaption}
      </p>
    </div>
  );
}

export default PlaygroundDemo;
