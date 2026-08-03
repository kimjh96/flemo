import { createContext } from "react";

// Identity of the OWNING Router for everything a screen renders — stamped as
// `data-flemo-router` on each screen and shared bar so the engine can scope a
// flight's choreography participants (its <Part>s) to ONE Router without DOM
// ancestry guesses: a root Router renders no container at all (viewport-fixed
// screens), and two independent Routers may share a DOM parent, so structure
// alone cannot draw the boundary.
const RouterIdContext = createContext<string | null>(null);

export default RouterIdContext;
