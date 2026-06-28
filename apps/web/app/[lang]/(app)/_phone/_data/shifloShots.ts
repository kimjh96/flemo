// The real shiflo App Store screenshots (public/shiflo), shown in the hero as a
// flemo-driven viewer: each is one screen in a nested <Router>, and flemo slides
// between them on the shared axis. They are promo images (headline + the shiflo
// light-blue backdrop baked in), all 1320x2868, so the backdrop stays continuous
// across the slide. Swap these for clean in-app captures to turn the viewer into
// a true device frame.
export interface ShifloShot {
  id: number;
  src: string;
}

export const SHIFLO_SHOTS: ShifloShot[] = [1, 2, 3, 4, 5].map((n) => ({
  id: n,
  src: `/shiflo/screenshot-${n}.png`
}));

export const SHOT_COUNT = SHIFLO_SHOTS.length;

// Native aspect of the screenshots (1320x2868), used to size the viewer.
export const SHOT_ASPECT = "1320 / 2868";
