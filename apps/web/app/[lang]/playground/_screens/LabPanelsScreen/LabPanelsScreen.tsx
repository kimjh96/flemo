"use client";

import { Screen, useNavigate, useParams } from "@flemo/react";

import LabPanelsRouter from "../../_router/LabPanelsRouter";

// The panel-browser screen of the OUTER lab Router: it hosts the nested panels
// Router (panels + the floating control dock as its persistent chrome) as one
// screen. Panel moves happen inside the nested Router, so this screen — and the
// dock with it — holds still; pushing the stress lab transitions this whole
// screen out, so the dock rides away with it and comes back on pop/swipe. The
// outer route is the `/playground/:n` catch-all, so panel pushes inside the
// nested Router change the URL without re-transitioning this level. The
// matched panel number (and a deep-linked `code` step) seeds the nested Router
// on both server and client.
function LabPanelsScreen() {
  const navigate = useNavigate();
  const params = useParams<"/playground/:n">();
  const code = params?.code;
  const initPath = `/playground/${params?.n ?? "1"}${code ? `?code=${code}` : ""}`;

  const handleOpenStressLab = () => {
    navigate.push("/playground/stress", {}, { transitionName: "cupertino" });
  };

  return (
    <Screen statusBarHeight="0px" systemNavigationBarHeight="0px" backgroundColor="var(--color-bg)">
      <LabPanelsRouter initPath={initPath} onOpenStressLab={handleOpenStressLab} />
    </Screen>
  );
}

export default LabPanelsScreen;
