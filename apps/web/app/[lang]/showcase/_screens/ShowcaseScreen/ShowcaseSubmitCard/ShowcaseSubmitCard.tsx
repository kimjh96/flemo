import Link from "next/link";

export interface ShowcaseSubmitCardProps {
  title: string;
  body: string;
  cta: string;
  href: string;
}

function ShowcaseSubmitCard({ title, body, cta, href }: ShowcaseSubmitCardProps) {
  return (
    <Link href={href} target="_blank" rel="noreferrer" className="showcase-submit">
      <span>
        <strong>{title}</strong>
        <small>{body}</small>
      </span>
      <span>{cta} ↗</span>
    </Link>
  );
}

export default ShowcaseSubmitCard;
