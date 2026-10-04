"use client";

import { createTransition } from "@flemo/react";

import { DOC_DURATION, DOC_EASE, DOC_OFFSET } from "./doc.constants";

const docBackward = createTransition({
  name: "doc-backward",
  initial: { y: `-${DOC_OFFSET}`, opacity: 0 },
  idle: {
    value: { y: 0, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { y: 0, opacity: 1 },
    options: { duration: DOC_DURATION, ease: DOC_EASE }
  },
  enterBack: {
    value: { y: `-${DOC_OFFSET}`, opacity: 0 },
    options: { duration: DOC_DURATION, ease: DOC_EASE }
  },
  exit: {
    value: { y: DOC_OFFSET, opacity: 0 },
    options: { duration: DOC_DURATION, ease: DOC_EASE }
  },
  exitBack: {
    value: { y: 0, opacity: 1 },
    options: { duration: DOC_DURATION, ease: DOC_EASE }
  }
});

export default docBackward;
