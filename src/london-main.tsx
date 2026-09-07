import { LondonStudyApp } from './studies/LondonStudyApp.tsx'
import { LONDON_EDITION } from './editions/london.ts'
import { mountMotionStudy } from '@motionstudies/web/mount-motion-study'
import '@motionstudies/web/shell.css'
import './styles/london.css'

mountMotionStudy(
  LONDON_EDITION,
  <LondonStudyApp edition={LONDON_EDITION} />,
)
