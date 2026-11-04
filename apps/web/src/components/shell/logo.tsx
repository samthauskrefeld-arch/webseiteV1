export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#14263D" />
      <path d="M10 27V14.5c0-.8.9-1.2 1.5-.7L20 21l8.5-7.2c.6-.5 1.5-.1 1.5.7V27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="30" r="2.6" fill="#20B6A8" />
    </svg>
  );
}
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight">My Minijob</span>
    </span>
  );
}
