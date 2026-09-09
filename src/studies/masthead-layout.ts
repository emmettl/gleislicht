/** Keep map overlays below translated headings, including after font loading. */
export function observeMasthead(header: HTMLElement | null) {
  const shell = header?.parentElement
  if (!header || !shell || typeof ResizeObserver === 'undefined') return
  const search = shell.querySelector<HTMLElement>('.train-search')
  const measure = () => {
    const padding = Number.parseFloat(getComputedStyle(header).paddingBottom) || 0
    shell.style.setProperty('--masthead-clearance', `${header.offsetTop + header.clientHeight - padding + 16}px`)
    if (search) shell.style.setProperty('--search-height', `${search.offsetHeight}px`)
  }
  const observer = new ResizeObserver(measure)
  observer.observe(header)
  if (search) observer.observe(search)
  measure()
  return () => {
    observer.disconnect()
    shell.style.removeProperty('--masthead-clearance')
    shell.style.removeProperty('--search-height')
  }
}
