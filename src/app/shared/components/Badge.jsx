export function badgeClass(map, key) {
  return map[key] || 'border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]';
}

export function Badge({ children, className = '' }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[13px] font-medium ${className}`}>{children}</span>;
}
