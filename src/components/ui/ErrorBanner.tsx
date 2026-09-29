import { TriangleAlert } from 'lucide-react'

interface ErrorBannerProps {
  message: string
}

/** Red banner under the header. The last good data stays visible beneath it. */
export default function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-card border border-accent-red/40 bg-accent-red/10 px-4 py-3 text-[13px] text-text"
    >
      <TriangleAlert size={18} className="mt-0.5 shrink-0 text-accent-red" aria-hidden="true" />
      <div>
        <span className="font-semibold text-accent-red">Airtable error, showing last good data. </span>
        <span>{message}</span>
      </div>
    </div>
  )
}
