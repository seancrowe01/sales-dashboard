// The little logo in the top left corner.
//
// To use your own logo, either replace the shape in here, or drop your own image into public/
// and swap the <svg> below for <img src="/your-logo.png" alt="" width={size} height={size} />.
// The name beside it comes from VITE_BRAND_NAME in your .env file.

interface MarkProps {
  size?: number
  className?: string
  title?: string
}

export default function Mark({ size = 36, className, title = 'Sales Dashboard' }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect x="2" y="2" width="44" height="44" rx="11" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
      {/* Three bars climbing, the plainest possible "sales are going up". */}
      <rect x="13" y="27" width="5" height="9" rx="2" fill="currentColor" fillOpacity="0.55" />
      <rect x="21.5" y="20" width="5" height="16" rx="2" fill="var(--brand-primary)" />
      <rect x="30" y="12" width="5" height="24" rx="2" fill="var(--brand-secondary)" />
    </svg>
  )
}
