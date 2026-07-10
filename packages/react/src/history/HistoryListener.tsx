import { useEffect } from "react";

import { ensureScopeHistorySync, releaseScopeHistorySync } from "@flemo/core";

import useStores from "@stores/useStores";

// Thin React binding: the popstate-to-navigation bridge AND its per-scope
// lifetime policy (a persistent scope's sync outlives the component; a root
// scope's follows the effect) live in @flemo/core; this component only maps
// them onto React's mount/unmount.
function HistoryListener() {
  const stores = useStores();

  useEffect(() => {
    ensureScopeHistorySync(stores);
    return () => releaseScopeHistorySync(stores);
  }, [stores]);

  return null;
}

export default HistoryListener;
