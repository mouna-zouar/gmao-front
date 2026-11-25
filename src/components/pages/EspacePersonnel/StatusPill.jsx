

export function StatusPill({ ton = 'neutre', children }) {
  return <span className={`ep-pill ep-ton--${ton}`}>{children}</span>;
}
