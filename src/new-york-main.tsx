import { mountMotionStudy } from './entries/mount-motion-study.tsx'
import { NEW_YORK_EDITION } from './editions/new-york.ts'
import { NewYorkStudyApp } from './studies/NewYorkStudyApp.tsx'
import './styles.css'
import './styles/new-york.css'

mountMotionStudy(
  NEW_YORK_EDITION,
  <NewYorkStudyApp edition={NEW_YORK_EDITION} />,
)
