import { checkEditionBoundary } from '@motionstudies/data/edition-boundary'

await checkEditionBoundary({ directories: ['src', 'scripts', 'realtime-worker', 'astra-worker'] })
console.log('gleislicht uses pinned npm releases and declared public imports.')
