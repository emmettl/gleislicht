/** Keep desktop overlays below translated headings, including after font loading. */
export function observeMasthead(header: HTMLElement | null) {
  const shell = header?.parentElement
  if (!header || !shell || typeof ResizeObserver === 'undefined') return
  const measure = () => {
    const padding = Number.parseFloat(getComputedStyle(header).paddingBottom) || 0
    shell.style.setProperty('--masthead-clearance', `${header.offsetTop + header.clientHeight - padding + 16}px`)
  }
  const observer = new ResizeObserver(measure)
  observer.observe(header)
  measure()
  return () => {
    observer.disconnect()
    shell.style.removeProperty('--masthead-clearance')
  }
}
