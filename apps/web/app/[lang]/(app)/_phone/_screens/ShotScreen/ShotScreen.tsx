"use client";

import { Screen, useNavigate, useParams } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/(app)/_providers/ShellIntlProvider";

import { SHIFLO_SHOTS, SHOT_COUNT } from "../../_data/shifloShots";

// One shiflo screenshot, rendered as a flemo Screen inside the hero's nested
// <Router>. Tapping anywhere advances to the next shot, which flemo slides in on
// the shared axis — so the marketing surface itself demonstrates flemo carrying
// real shiflo screens, not a mockup. The image covers the screen; since every
// shot shares the same backdrop and aspect, the slide reads as continuous.
function ShotScreen() {
  const params = useParams<"/shiflo-shot/:n">();
  const navigate = useNavigate();
  const dict = useShellDict();

  const index = Number(params?.n ?? "1");
  const shot = SHIFLO_SHOTS[index - 1] ?? SHIFLO_SHOTS[0]!;

  const handleAdvance = () => {
    const next = (index % SHOT_COUNT) + 1;
    navigate.replace(
      "/shiflo-shot/:n",
      { n: String(next) },
      { transitionName: "shared-axis-forward" }
    );
  };

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="transparent">
      <button
        type="button"
        onClick={handleAdvance}
        aria-label={dict.home.shotNext}
        className="block h-full w-full cursor-pointer"
      >
        <img
          src={shot.src}
          alt={dict.home.shotAlt}
          draggable={false}
          className="h-full w-full object-cover"
        />
      </button>
    </Screen>
  );
}

export default ShotScreen;
