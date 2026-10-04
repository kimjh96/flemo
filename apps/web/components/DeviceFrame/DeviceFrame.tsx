import type { HTMLAttributes, ReactNode } from "react";

export interface DeviceFrameProps {
  children: ReactNode;
  // Height of the whole device; width follows a 1:2 phone.
  height?: string;
  // Spread onto the glass, e.g. a data attribute a test reads.
  screenProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string>;
  // Paints the signal glow behind the device.
  glow?: boolean;
  className?: string;
}

// The one device the site draws. A dark bezel in both themes, because phones are
// dark objects; the glass inside follows the theme.
//
// THE GLOW MUST OWN ITS LAYER. It sits under the bezel, and WebKit paints an
// unpromoted element into the backing it shares with what it overlaps: every
// transition inside the glass promotes and demotes screen layers at its first and
// last frame, and each time WebKit re-rastered an overlapping blur on the main
// thread (measured at 50-87ms on the previous stage). `will-change: transform`
// keeps it on its own layer so the transition never touches it.
function DeviceFrame({
  children,
  height = "min(720px, calc(100dvh - 9rem))",
  screenProps,
  glow,
  className
}: DeviceFrameProps) {
  return (
    <div className={`relative w-fit ${className ?? ""}`}>
      {glow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[18%] -z-0 rounded-full will-change-transform"
          style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
        />
      )}
      <div
        className="relative aspect-[380/760] rounded-device bg-[#0c0c0e] p-1.5 shadow-device ring-1 ring-black/40 dark:ring-white/10"
        style={{ height }}
      >
        <div
          {...screenProps}
          className={`relative h-full overflow-hidden rounded-[40px] bg-bg ${screenProps?.className ?? ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default DeviceFrame;
