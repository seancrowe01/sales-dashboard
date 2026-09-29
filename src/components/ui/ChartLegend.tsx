export interface LegendItem {
  name: string
  color: string
}

interface ChartLegendProps {
  items: LegendItem[]
}

/** Legend row under a chart: coloured squares with muted labels. */
export default function ChartLegend({ items }: ChartLegendProps) {
  if (items.length === 0) return null
  return (
    <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-2 text-[12px] text-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} aria-hidden="true" />
          {item.name}
        </li>
      ))}
    </ul>
  )
}
