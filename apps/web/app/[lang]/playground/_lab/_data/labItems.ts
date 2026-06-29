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

export function labItemById(id: string): LabItem | undefined {
  return LAB_ITEMS.find((item) => item.id === id);
}
