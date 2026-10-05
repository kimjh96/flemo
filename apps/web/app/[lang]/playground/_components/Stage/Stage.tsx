import type { PropsWithChildren } from "react";

import DeviceFrame from "@/components/DeviceFrame";

// The device a bench runs in: the site's one DeviceFrame, with the
// `data-playground-stage` hook the e2e suites measure against.
//
// Nothing around the glass moves on its own. A page that animates while a
// transition is being judged changes the measurement rather than dressing it.
function Stage({ children }: PropsWithChildren) {
  return (
    <DeviceFrame
      glow
      height="min(720px, calc(100dvh - 8rem))"
      screenProps={{ "data-playground-stage": "" }}
    >
      {children}
    </DeviceFrame>
  );
}

export default Stage;
