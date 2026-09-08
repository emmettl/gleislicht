import AtlasExperience from './AtlasExperience.tsx'
import { SWITZERLAND_EDITION } from './editions/switzerland.ts'
import { mountMotionStudy } from '@motionstudies/web/mount-motion-study'
import './styles.css'
mountMotionStudy(SWITZERLAND_EDITION, <AtlasExperience />)
