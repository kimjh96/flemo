import { PLACE_ART, type PlaceId } from "../../_data/places";

export interface MiniArtworkProps {
  place: PlaceId;
  className?: string;
}

// A place's "photo": its gradient with a soft horizon, so a thumbnail and the
// hero it grows into read as the same picture at two sizes.
function MiniArtwork({ place, className }: MiniArtworkProps) {
  const { from, to } = PLACE_ART[place];

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/5"
        style={{ background: "linear-gradient(to top, rgb(0 0 0 / 0.28), transparent)" }}
      />
      <div
        aria-hidden="true"
        className="absolute top-[22%] right-[18%] aspect-square w-[18%] rounded-full bg-white/70"
      />
    </div>
  );
}

export default MiniArtwork;
