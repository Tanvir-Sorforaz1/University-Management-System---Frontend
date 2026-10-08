export function ArchMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup" aria-label="Bangladesh University">
      <svg aria-hidden="true" className="arch-mark" viewBox="0 0 28 32" fill="none">
        <path d="M3 29V14a11 11 0 0 1 22 0v15" stroke="var(--lapis-700)" strokeWidth="2" />
        <circle cx="14" cy="17" r="3" fill="var(--saffron-500)" />
      </svg>
      {!compact && <span className="brand-name">Bangladesh University</span>}
    </span>
  );
}