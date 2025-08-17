import { type PropsWithChildren, Suspense, type ReactNode } from "react";

const infiniteThenable = { then() {} };

function Suspender({
  freeze,
  children
}: PropsWithChildren<{
  freeze: boolean;
}>) {
  if (freeze) {
    throw infiniteThenable;
  }
  return children;
}

interface ScreenFreezeProps {
  freeze: boolean;
  children: ReactNode;
  placeholder?: ReactNode;
}

function ScreenFreeze({ freeze, children, placeholder }: ScreenFreezeProps) {
  return (
    <Suspense fallback={placeholder}>
      <Suspender freeze={freeze}>{children}</Suspender>
    </Suspense>
  );
}

export default ScreenFreeze;
