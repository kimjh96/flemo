type IconName =
  | "shop"
  | "cart"
  | "user"
  | "back"
  | "forward"
  | "close"
  | "heart"
  | "share"
  | "search"
  | "plus"
  | "minus"
  | "check"
  | "bag"
  | "star"
  | "ruler";

const PATHS: Record<IconName, string> = {
  shop: "M4 7h16l-1 12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 7zM8 7V5a4 4 0 0 1 8 0v2",
  cart: "M3 4h2l2.4 11.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  user: "M16 14a4 4 0 1 0-8 0M19 21a7 7 0 0 0-14 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  back: "M15 18l-6-6 6-6",
  forward: "M9 6l6 6-6 6",
  close: "M18 6L6 18M6 6l12 12",
  heart:
    "M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.66l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.79 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  share: "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M5 12l4 4L19 6",
  bag: "M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7zM9 7V5a3 3 0 0 1 6 0v2",
  star: "M12 3l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6L12 3z",
  ruler: "M3 9l12-6 6 12-12 6L3 9zM7 11l1 2M10 9.5l1 2M13 8l1 2M16 6.5l1 2"
};

export default function Icon({
  name,
  size = 22,
  className = ""
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
