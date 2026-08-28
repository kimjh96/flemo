"use client";

import { createTransition } from "@flemo/react";

import "./aperture.types";

// The screen transition the container-transform case runs on, and it is the
// deleted playground's `sheet` brought forward: the pairing the user judged
// good there was exactly zoom-plus-sheet.
//
// THE ARRIVAL IS OPAQUE and settles a little scale instead of fading. The
// sheet's own note records why a fade was wrong ("the list's tiles read
// straight through the detail's text"), and this page re-learned it twice
// more: a front-loaded fade covers the grid the camera is still pushing out,
// and holding the screen clear instead renders nothing at all, because a
// morph staged in the flight layer is still subject to its screen. Neither is
// tried again.
//
// THE COVERED SCREEN pushes out and blurs, the way a lens racks focus past
// it. From the GRID the camera supersedes this screen's transform (that is
// what `carry` means), so what survives there is the blur riding the camera's
// own push, which is the reference combination. From the LIST there is no
// camera, and the recede-and-blur is the whole background story: the artwork
// opens over a list that falls away, instead of over a white sheet.
//
// The DURATION is why this exists rather than reusing `layout`: a morph
// authors no duration, so the camera, the card and the type inside it all run
// for exactly this long, and 0.5s is the top of Material's container-transform
// band.
const DURATION = 0.5;
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const aperture = createTransition({
  name: "aperture",
  initial: { opacity: 1, scale: 1.03 },
  idle: {
    value: { scale: 1, filter: "blur(0px)" },
    options: { duration: 0 }
  },
  enter: {
    value: { scale: 1 },
    options: { duration: DURATION, ease: EASE }
  },
  // THE POP LEAVES EARLY. Held opaque, the dismissing page covers the list
  // for the whole flight and then blinks away at the unmount, so the return
  // read as a held white sheet with a swap at the end. The page instead drops
  // out on a hard front-loaded curve: mostly gone within the first tenth of
  // the flight, which uncovers the list while the artwork still has the whole
  // glide home ahead of it. The scale keeps the sheet's outward gesture and,
  // running the full duration, is also the clock the flight lands on.
  enterBack: {
    value: { scale: 1.03, opacity: 0 },
    options: { duration: DURATION, ease: [0.1, 1, 0.2, 1] }
  },
  // The background follows the MORPH'S direction: the element is opening out
  // to fill the screen, so what is behind it pushes out too. Scaling it down
  // instead reads as the background retreating, the opposite gesture.
  exit: {
    value: { scale: 1.08, filter: "blur(10px)" },
    options: { duration: DURATION, ease: EASE }
  },
  exitBack: {
    value: { scale: 1, filter: "blur(0px)" },
    options: { duration: DURATION, ease: EASE }
  }
});

export default aperture;
