"use client";

import { useShellDict } from "@/app/[lang]/(app)/_providers/ShellIntlProvider";

import ShifloDemoRouter from "../_router/ShifloDemoRouter";

// The hero's right-column showcase: the shiflo viewer plus its caption. Sized to
// the screenshot aspect with a comfortable cap so it reads as a device without
// pretending to be a second phone frame around the (already framed) promo shots.
function ShifloDemo() {
  const dict = useShellDict();

  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-4">
      <ShifloDemoRouter />
      <p className="text-center text-sm font-medium text-[var(--color-text-secondary)]">
        {dict.home.demoCaption}
      </p>
    </div>
  );
}

export default ShifloDemo;
