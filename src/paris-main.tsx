import { mountMotionStudy } from '@motionstudies/web/mount-motion-study'
import { PARIS_EDITION } from './editions/paris.ts'
import { ParisStudyApp } from './studies/ParisStudyApp.tsx'
import '@motionstudies/web/shell.css'
import './styles/paris.css'

mountMotionStudy(
  PARIS_EDITION,
  <ParisStudyApp edition={PARIS_EDITION} />,
)
