import HomeHeader from "./_components/HomeHeader";

export default async function Layout({ params, children }: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  return (
    <>
      <HomeHeader lang={lang} />
      {children}
    </>
  );
}
