import AtlasExperience from './AtlasExperience.tsx'
import { SWITZERLAND_EDITION } from './editions/switzerland.ts'
import { mountMotionStudy } from '@motionstudies/web/mount-motion-study'
import './styles.css'
// Phones keep their existing CSS payload; load laptop chrome on demand, also
// when a narrow window is resized onto a desktop display.
const compactDesktop = window.matchMedia('(min-width: 701px)')
const loadDesktopChrome = () => {
  if (!compactDesktop.matches) return
  void import('./studies/compact-desktop.css').then(() => {
    compactDesktop.removeEventListener('change', loadDesktopChrome)
  }).catch(() => { /* Keep the existing layout if the optional stylesheet fails. */ })
}
compactDesktop.addEventListener('change', loadDesktopChrome)
loadDesktopChrome()
mountMotionStudy(SWITZERLAND_EDITION, <AtlasExperience />)
