import Logo from "@/components/Logo";

export interface HomeFooterProps {
  built: string;
}

function HomeFooter({ built }: HomeFooterProps) {
  return (
    <footer className="bg-[var(--color-bg)]">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-8">
        <span className="text-[13px] text-[var(--color-neutral-600)]">{built}</span>
        <span className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
          <Logo size={20} className="rounded-[5px]" />
          flemo
        </span>
      </div>
    </footer>
  );
}

export default HomeFooter;
