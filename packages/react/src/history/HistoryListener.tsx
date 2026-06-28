import { useEffect } from "react";

import { createHistorySync } from "@flemo/core";

import useStores from "@stores/useStores";

// Thin React binding: the popstate-to-navigation bridge lives in @flemo/core's
// createHistorySync; this component owns only the effect lifecycle.
function HistoryListener() {
  const stores = useStores();

  useEffect(() => createHistorySync({ stores, driver: stores.driver }), [stores]);

  return null;
}

export default HistoryListener;
