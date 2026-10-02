import Link from "next/link";

interface StoreLink {
  label: string;
  href: string;
}

export interface ShowcaseAppCardProps {
  name: string;
  tagline: string;
  description: string;
  flemoUsageLabel: string;
  flemoUsage: string;
  languagesLabel: string;
  languages: string[];
  logo: string;
  appStore?: StoreLink;
  playStore?: StoreLink;
}

function ShowcaseAppCard({
  name,
  tagline,
  description,
  flemoUsageLabel,
  flemoUsage,
  languagesLabel,
  languages,
  logo,
  appStore,
  playStore
}: ShowcaseAppCardProps) {
  return (
    <article className="showcase-app">
      <div className="showcase-app-brand">
        <div className="showcase-app-brand-top">
          <span>flemo / 01</span>
          <span>↗</span>
        </div>
        <div>
          <img src={logo} alt="" width={76} height={76} />
          <h2>{name}</h2>
          <p>{tagline}</p>
        </div>
      </div>
      <div className="showcase-app-info">
        <p className="showcase-app-description">{description}</p>
        <div className="showcase-app-usage">
          <span className="site-overline">{flemoUsageLabel}</span>
          <p>{flemoUsage}</p>
        </div>
        <div className="showcase-app-bottom">
          <p>
            <strong>{languagesLabel}</strong>
            <span>{languages.join(", ")}</span>
          </p>
          <div>
            {appStore && (
              <Link href={appStore.href} target="_blank" rel="noreferrer">
                {appStore.label} ↗
              </Link>
            )}
            {playStore && (
              <Link href={playStore.href} target="_blank" rel="noreferrer">
                {playStore.label} ↗
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default ShowcaseAppCard;
