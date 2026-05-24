export interface PlaygroundToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  on: string;
  off: string;
}

function PlaygroundToggleSwitch({ checked, onChange, on, off }: PlaygroundToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-layer)] px-4 py-3 transition-colors hover:border-[var(--color-border-dark)]"
    >
      <span className="text-[13.5px] font-medium text-[var(--color-text-primary)]">
        {checked ? on : off}
      </span>
      <span
        className="relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
        style={{
          backgroundColor: checked ? "var(--color-primary)" : "var(--color-neutral-400)"
        }}
        aria-hidden="true"
      >
        <span
          className="absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </span>
    </button>
  );
}

export default PlaygroundToggleSwitch;
