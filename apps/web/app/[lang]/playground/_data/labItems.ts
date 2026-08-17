// Demo content for the playground lab, a few colourful cards to push into. The
// hues are decorative demo data (like the music playground's album art), not
// shiflo tokens.
export interface LabItem {
  id: string;
  title: string;
  hue: number;
}

export const LAB_ITEMS: LabItem[] = [
  { id: "1", title: "Aurora", hue: 212 },
  { id: "2", title: "Coral", hue: 8 },
  { id: "3", title: "Mint", hue: 162 },
  { id: "4", title: "Violet", hue: 268 },
  { id: "5", title: "Amber", hue: 36 },
  { id: "6", title: "Rose", hue: 330 }
];

export function gradientForHue(hue: number): string {
  return `linear-gradient(135deg, hsl(${hue} 82% 62%), hsl(${(hue + 28) % 360} 76% 50%))`;
}

// Skia renders CSS gradients WITH dither noise; when a screen-sized gradient
// slides through a transition's decelerating tail, every one-pixel step
// decorrelates that grain across the whole surface — a full-field flicker
// the eye reads as end-of-transition judder (video-verified; step COUNT
// scales with travel distance, so it is duration-invariant). This gradient
// is gentle enough (a quantization band every 60px+ per channel) that dither
// buys nothing, so the panels use a grain-FREE bake: pixels computed
// directly (plain rounding, no dither) into a small canvas, upscaled by the
// GPU's bilinear filter. Texels are fixed, so the surface slides rigidly.
const bakedGradients = new Map<string, string>();

const hslChannel = (h: number, s: number, l: number, n: number): number => {
  const k = (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
};

export function bakedGradientForHue(hue: number, aspect = 1): string {
  if (typeof document === "undefined") return gradientForHue(hue);
  // Aspect buckets keep the cache small across resizes while staying within
  // a couple of pixels of the exact geometry.
  const ratio = Math.round(Math.max(0.1, Math.min(10, aspect)) * 20) / 20;
  const key = `${hue}:${ratio}`;
  const cached = bakedGradients.get(key);
  if (cached) return cached;
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) return gradientForHue(hue);
  const from = [0, 8, 4].map((n) => hslChannel(hue, 0.82, 0.62, n));
  const to = [0, 8, 4].map((n) => hslChannel((hue + 28) % 360, 0.76, 0.5, n));
  const image = context.createImageData(SIZE, SIZE);
  // 135deg in the TARGET box's pixel space: CSS distributes the stops along
  // the true 135° axis (t ∝ X+Y in pixels), so a square bake must weigh its
  // texels by the box it will stretch onto — t = (x·W + y·H) / (W+H) with
  // W/H the target aspect. A plain (x+y)/2 bake is only equivalent on a
  // square box; stretched onto a wide screen its ramp tilts and compresses,
  // which made the at-rest swap from the SSR gradient visibly pop.
  const w = ratio;
  const h = 1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const t = (x * w + y * h) / ((SIZE - 1) * (w + h));
      const i = (y * SIZE + x) * 4;
      image.data[i] = Math.round(from[0] + (to[0] - from[0]) * t);
      image.data[i + 1] = Math.round(from[1] + (to[1] - from[1]) * t);
      image.data[i + 2] = Math.round(from[2] + (to[2] - from[2]) * t);
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const value = `url(${canvas.toDataURL("image/png")}) center / 100% 100%`;
  bakedGradients.set(key, value);
  return value;
}

export function labItemById(id: string): LabItem | undefined {
  return LAB_ITEMS.find((item) => item.id === id);
}
