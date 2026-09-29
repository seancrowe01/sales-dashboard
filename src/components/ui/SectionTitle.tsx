import type { LucideIcon } from 'lucide-react'

interface SectionTitleProps {
  icon: LucideIcon
  title: string
}

/** Section heading: 20px icon in brand cyan next to a 20px semibold display title. */
export default function SectionTitle({ icon: Icon, title }: SectionTitleProps) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <Icon size={20} className="text-brand-primary" aria-hidden="true" />
      <h2 className="font-display text-[20px] font-semibold leading-tight text-text">{title}</h2>
    </div>
  )
}
