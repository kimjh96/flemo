import HomeHeader from "../(home)/_components/HomeHeader";

export default async function Layout({ params, children }: LayoutProps<"/[lang]/showcase">) {
  const { lang } = await params;

  return (
    <>
      <HomeHeader lang={lang} />
      {children}
    </>
  );
}
