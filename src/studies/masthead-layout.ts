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

/** Source credits can wrap across several lines in regional and translated views. */
export function observeFooter(footer: HTMLElement | null) {
  const shell = footer?.parentElement
  if (!footer || !shell || typeof ResizeObserver === 'undefined') return
  const measure = () => {
    const bottom = Number.parseFloat(getComputedStyle(footer).bottom) || 0
    shell.style.setProperty('--footer-clearance', `${footer.offsetHeight + bottom + 8}px`)
  }
  const observer = new ResizeObserver(measure)
  observer.observe(footer)
  measure()
  return () => {
    observer.disconnect()
    shell.style.removeProperty('--footer-clearance')
  }
}

/** Keep scrollable journey details above the current playback controls. */
export function observePlayback(controls: HTMLElement | null) {
  const shell = controls?.parentElement
  if (!controls || !shell || typeof ResizeObserver === 'undefined') return
  const measure = () => {
    const bottom = Number.parseFloat(getComputedStyle(controls).bottom) || 0
    shell.style.setProperty('--playback-clearance', `${controls.offsetHeight + bottom + 12}px`)
  }
  // Footer measurement can change the playback bottom inset in the same
  // observer delivery. Read it next frame, after those CSS variables settle.
  let frame = 0
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(measure)
  })
  observer.observe(controls)
  observer.observe(shell)
  const footer = shell.querySelector('footer')
  if (footer) observer.observe(footer)
  measure()
  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    shell.style.removeProperty('--playback-clearance')
  }
}
