/** A published app pins one immutable data release for its entire session. */
export function resolveDataRoot({ override, published, local, development }: { override?: string; published: string; local: string; development: boolean }) {
  const root = override?.trim() || (development ? local : published)
  if (!root) throw new Error('No published timetable release is configured')
  if (root !== local) {
    const url = new URL(root)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Published data must use an HTTPS URL without credentials, query or fragment')
  }
  return root.endsWith('/') ? root : `${root}/`
}
