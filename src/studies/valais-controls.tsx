export function ValaisDateSelect({ label, value, onChange }: {
  label: string
  value: string
  onChange: (date: string) => void
}) {
  return <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
    <option value="2026-09-04">2026-09-04</option>
    <option value="2026-09-06">2026-09-06</option>
  </select>
}
