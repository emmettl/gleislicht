// Initialized before mounting the study; ordinary visits load no debug module.
export let gpuDebugEnabled = false
export const initializeEditionDebug = async () => {
  if (!new URLSearchParams(location.search).has('debug')) return
  try {
    const { initializeDebug } = await import('./debug-bootstrap.ts')
    gpuDebugEnabled = await initializeDebug()
  } catch (error) {
    console.warn('GPU debug tools unavailable', error)
  }
}
