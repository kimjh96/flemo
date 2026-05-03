type Props = {
  size?: number;
  className?: string;
};

export default function Logo({ size = 26, className = "rounded-md" }: Props) {
  return (
    <>
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        className={`${className} block dark:hidden`}
      />
      <img
        src="/logo-dark.png"
        alt=""
        width={size}
        height={size}
        className={`${className} hidden dark:block`}
      />
    </>
  );
}
