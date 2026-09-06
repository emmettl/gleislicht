import { mountMotionStudy } from './entries/mount-motion-study.tsx'
import { PARIS_EDITION } from './editions/paris.ts'
import { ParisStudyApp } from './studies/ParisStudyApp.tsx'
import './styles.css'
import './styles/paris.css'

mountMotionStudy(
  PARIS_EDITION,
  <ParisStudyApp edition={PARIS_EDITION} />,
)
