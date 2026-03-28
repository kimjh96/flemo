import { type ReactNode, useRef } from "react";

interface ScreenFreezeProps {
  freeze: boolean;
  children: ReactNode;
}

function ScreenFreeze({ freeze, children }: ScreenFreezeProps) {
  const frozenChildren = useRef(children);

  if (!freeze) {
    frozenChildren.current = children;
  }

  return (
    <div
      style={{
        display: freeze ? "none" : undefined
      }}
    >
      {frozenChildren.current}
    </div>
  );
}

export default ScreenFreeze;
