import { LondonStudyApp } from './studies/LondonStudyApp.tsx'
import { LONDON_EDITION } from './editions/london.ts'
import { mountMotionStudy } from './entries/mount-motion-study.tsx'
import './styles.css'
import './styles/london.css'

mountMotionStudy(
  LONDON_EDITION,
  <LondonStudyApp edition={LONDON_EDITION} />,
)
