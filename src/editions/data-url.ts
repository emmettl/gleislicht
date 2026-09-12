import { createDataUrlResolver } from '@motionstudies/web/data-url'
// Vite validates and embeds the root at build time; isolated unit tests use fixtures.
export const editionDataUrl = createDataUrlResolver(
  import.meta.env.VITE_GLEISLICHT_RESOLVED_DATA_URL ?? `${import.meta.env.BASE_URL}data/`,
)
