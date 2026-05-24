import type { ReactNode } from "react";

import HomeHeader from "./_components/HomeHeader";

export default async function Layout({
  params,
  children
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return (
    <>
      <HomeHeader lang={lang} />
      {children}
    </>
  );
}
