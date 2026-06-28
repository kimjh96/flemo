import ShellApp from "@/app/[lang]/(app)/_components/ShellApp";

// Preview route for the flemo app shell. noindex while it's a skeleton — it is
// not linked from the live site and does not replace the real landing/showcase
// pages yet. The shell is promoted to `/` once content migration and the zone
// history driver land.
export const metadata = {
  title: "flemo · app shell (preview)",
  robots: { index: false, follow: false }
};

export default async function ShellPage({ params }: PageProps<"/[lang]/shell">) {
  const { lang } = await params;

  return <ShellApp lang={lang} />;
}
