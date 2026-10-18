/** Read and write layout after ResizeObserver delivery, coalescing resize bursts. */
function observeLayout(elements: Element[], measure: () => void) {
  let frame = 0
  const observer = new ResizeObserver(() => {
    if (frame) return
    frame = requestAnimationFrame(() => { frame = 0; measure() })
  })
  elements.forEach(element => observer.observe(element))
  measure()
  return () => { cancelAnimationFrame(frame); observer.disconnect() }
}

function measurePlayback(controls: HTMLElement, shell: HTMLElement) {
  const bottom = Number.parseFloat(getComputedStyle(controls).bottom) || 0
  shell.style.setProperty('--playback-clearance', `${controls.offsetHeight + bottom + 12}px`)
}

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
  const cleanup = observeLayout(search ? [header, search] : [header], measure)
  return () => {
    cleanup()
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
    // Wrapping credits can move playback without changing its observed size.
    const controls = shell.querySelector<HTMLElement>('.transport')
    if (controls) measurePlayback(controls, shell)
  }
  const cleanup = observeLayout([footer], measure)
  return () => {
    cleanup()
    shell.style.removeProperty('--footer-clearance')
  }
}

/** Keep scrollable journey details above the current playback controls. */
export function observePlayback(controls: HTMLElement | null) {
  const shell = controls?.parentElement
  if (!controls || !shell || typeof ResizeObserver === 'undefined') return
  const measure = () => measurePlayback(controls, shell)
  const footer = shell.querySelector('footer')
  const cleanup = observeLayout(footer ? [controls, shell, footer] : [controls, shell], measure)
  return () => {
    cleanup()
    shell.style.removeProperty('--playback-clearance')
  }
}
