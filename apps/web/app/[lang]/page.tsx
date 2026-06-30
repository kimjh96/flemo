import ShellApp from "@/app/[lang]/_components/ShellApp";

// The landing. The flemo app shell, served at `/` (and `/ko`). The shell seeds
// its Router from `initPath`, so the home screen server-renders directly.
export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;

  return <ShellApp lang={lang} initPath="/" />;
}
