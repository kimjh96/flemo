import { useContext } from "react";

import ScreenContext from "@screen/ScreenContext";

export default function useScreen() {
  return useContext(ScreenContext);
}
