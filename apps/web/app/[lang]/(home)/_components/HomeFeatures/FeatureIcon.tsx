import type { FeatureIconKind } from "./HomeFeatures.types";

const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round"
} as const;

export interface FeatureIconProps {
  icon: FeatureIconKind;
}

function FeatureIcon({ icon }: FeatureIconProps) {
  switch (icon) {
    case "phone":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <rect x="6" y="3" width="12" height="18" rx="2.5" {...STROKE_PROPS} />
          <path d="M11 17h2" {...STROKE_PROPS} />
        </svg>
      );
    case "swipe":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M5 12h14" {...STROKE_PROPS} />
          <path d="M11 6l-6 6 6 6" {...STROKE_PROPS} />
          <path d="M19 7v10" {...STROKE_PROPS} />
        </svg>
      );
    case "code":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M9 8l-5 4 5 4" {...STROKE_PROPS} />
          <path d="M15 8l5 4-5 4" {...STROKE_PROPS} />
          <path d="M14 5l-4 14" {...STROKE_PROPS} />
        </svg>
      );
    case "layers":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M12 3l9 5-9 5-9-5 9-5z" {...STROKE_PROPS} />
          <path d="M3 13l9 5 9-5" {...STROKE_PROPS} />
          <path d="M3 17l9 5 9-5" {...STROKE_PROPS} />
        </svg>
      );
    case "sparkle":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path
            d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z"
            {...STROKE_PROPS}
          />
          <path
            d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7L19 16z"
            {...STROKE_PROPS}
          />
        </svg>
      );
    case "palette":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path
            d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.5-1.1-.4-.4-.5-.9-.5-1.4 0-1 .9-1.8 1.9-1.8H16a5 5 0 0 0 5-5 9 9 0 0 0-9-7.2z"
            {...STROKE_PROPS}
          />
          <circle cx="7.5" cy="11" r=".9" fill="currentColor" />
          <circle cx="9" cy="7.5" r=".9" fill="currentColor" />
          <circle cx="13" cy="6.5" r=".9" fill="currentColor" />
          <circle cx="16.5" cy="9" r=".9" fill="currentColor" />
        </svg>
      );
  }
}

export default FeatureIcon;
