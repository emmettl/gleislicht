import { mountMotionStudy } from '@motionstudies/web/mount-motion-study'
import { NEW_YORK_EDITION } from './editions/new-york.ts'
import { NewYorkStudyApp } from './studies/NewYorkStudyApp.tsx'
import '@motionstudies/web/shell.css'
import './styles/new-york.css'

mountMotionStudy(
  NEW_YORK_EDITION,
  <NewYorkStudyApp edition={NEW_YORK_EDITION} />,
)
