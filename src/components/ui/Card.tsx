import type { ReactNode } from 'react'

interface CardProps {
  title: string
  subtitle?: string
  children: ReactNode
  /** Extra classes on the outer card (e.g. for table cards). */
  className?: string
}

/** Plain elevated card with a title and subtitle, used for charts and tables. */
export default function Card({ title, subtitle, children, className = '' }: CardProps) {
  return (
    <section className={`rounded-card border border-line bg-surface p-5 ${className}`}>
      <header className="mb-4">
        <h3 className="font-display text-[17px] font-semibold leading-tight text-text">{title}</h3>
        {subtitle ? <p className="mt-1 text-[13px] text-muted">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  )
}
