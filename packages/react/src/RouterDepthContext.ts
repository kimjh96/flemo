import { createContext } from "react";

// How many <Router>s enclose this point. A root <Router> reads 0; any <Router>
// rendered inside another reads > 0 and treats itself as a nested transition
// region (own local history, screens contained to its box, no global history
// wiring). Each <Router> increments it for its subtree.
const RouterDepthContext = createContext(0);

export default RouterDepthContext;
