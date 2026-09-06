import { App } from './App.tsx'
import { SWITZERLAND_EDITION } from './editions/switzerland.ts'
import { mountMotionStudy } from '@motionstudies/web/mount-motion-study.tsx'
import './styles.css'

mountMotionStudy(
  SWITZERLAND_EDITION,
  <App edition={SWITZERLAND_EDITION} />,
)
