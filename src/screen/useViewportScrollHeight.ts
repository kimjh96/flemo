import { useEffect, useState } from "react";

let initialViewportScrollHeight = 0;

export default function useViewportScrollHeight() {
  const [viewportScrollHeight, setViewportScrollHeight] = useState(0);
  const [changedViewportScrollHeight, setChangedViewportScrollHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      let newViewportScrollHeight =
        document.documentElement.scrollHeight - (window.visualViewport?.height || 0);
      newViewportScrollHeight = newViewportScrollHeight < 0 ? 0 : newViewportScrollHeight;
      let newChangedViewportScrollHeight = newViewportScrollHeight - initialViewportScrollHeight;
      newChangedViewportScrollHeight =
        newChangedViewportScrollHeight < 0 ? 0 : newChangedViewportScrollHeight;

      if (!initialViewportScrollHeight) {
        initialViewportScrollHeight = newViewportScrollHeight;
      }

      setChangedViewportScrollHeight(newChangedViewportScrollHeight);
      setViewportScrollHeight(newViewportScrollHeight);
    };

    window.visualViewport?.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("scroll", handleResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, []);

  return { viewportScrollHeight, changedViewportScrollHeight };
}
