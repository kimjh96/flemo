export interface Piece {
  id: string;
  title: string;
  place: string;
  hue: number;
}

// Flat gradients rather than photographs on purpose: a morph fixture should
// show the MOTION, and an image would put decode timing in the middle of the
// exact frames being judged.
export const PIECES: Piece[] = [
  { id: "1", title: "Harbour Light", place: "Busan", hue: 205 },
  { id: "2", title: "Salt Flats", place: "Uyuni", hue: 168 },
  { id: "3", title: "Paper Lanterns", place: "Kyoto", hue: 18 },
  { id: "4", title: "Night Market", place: "Taipei", hue: 292 },
  { id: "5", title: "Low Tide", place: "Jeju", hue: 190 },
  { id: "6", title: "Rooftops", place: "Porto", hue: 38 },
  { id: "7", title: "Fog Line", place: "Bergen", hue: 220 },
  { id: "8", title: "Terracotta", place: "Marrakesh", hue: 8 }
];

export const pieceById = (id: string): Piece | undefined => PIECES.find((p) => p.id === id);

export const surfaceFor = (hue: number): string =>
  `linear-gradient(150deg, hsl(${hue} 78% 64%), hsl(${(hue + 46) % 360} 68% 46%))`;
