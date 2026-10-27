/** The Catchline mark: a dot on a claim, a leader line, a small card. Drawn in Prussian. */
export function Mark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className="cl-mark">
      <circle cx="3" cy="12" r="1.75" fill="var(--cl-prussian)" />
      <path
        d="M3 12C8 12 7 5.5 11 5.5"
        stroke="var(--cl-prussian)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="10.5"
        y="2.5"
        width="4.5"
        height="6"
        rx="1.25"
        stroke="var(--cl-prussian)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
