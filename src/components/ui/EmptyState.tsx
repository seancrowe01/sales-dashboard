import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  message: string
  hint?: string
}

/** Centered muted message for cards with nothing to show. */
export default function EmptyState({ message, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-mini border border-dashed border-line px-4 py-10 text-center">
      <Inbox size={22} className="text-muted" aria-hidden="true" />
      <p className="text-[14px] font-medium text-text">{message}</p>
      {hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  )
}
