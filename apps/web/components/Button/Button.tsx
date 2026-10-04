import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

// The site's only button. Three variants, three sizes, one radius. Navigation
// inside the flemo shell is a <button> that pushes; an off-site link is the
// same look rendered as <a> through `ButtonLink`.
const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-fg text-bg hover:bg-fg/85",
  secondary:
    "border border-line-strong bg-surface text-fg hover:border-fg-subtle hover:bg-surface-2",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg"
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 rounded-md px-3 text-sm",
  md: "h-10 rounded-md px-4 text-sm",
  lg: "h-12 rounded-lg px-5 text-body"
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]}`;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={`${buttonClass(variant, size)} ${className ?? ""}`} {...rest} />
  );
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <a className={`${buttonClass(variant, size)} ${className ?? ""}`} {...rest} />;
}

export default Button;
