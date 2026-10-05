// The mini app's content. Four places, each with its own two-stop gradient so
// the artwork reads as a photo without shipping one.
export const PLACE_IDS = ["kyoto", "lisbon", "oaxaca", "reykjavik"] as const;

export type PlaceId = (typeof PLACE_IDS)[number];

export const PLACE_ART: Record<PlaceId, { from: string; to: string }> = {
  kyoto: { from: "#ff7a45", to: "#c2185b" },
  lisbon: { from: "#ffc94d", to: "#ff6224" },
  oaxaca: { from: "#7cc4ff", to: "#5b4bd1" },
  reykjavik: { from: "#7ee2b8", to: "#127a8a" }
};

export const isPlaceId = (value: unknown): value is PlaceId =>
  typeof value === "string" && (PLACE_IDS as readonly string[]).includes(value);
