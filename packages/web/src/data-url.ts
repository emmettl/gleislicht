export type DataUrlResolver = (fileName: string) => string

/** The consumer supplies its asset root; packages do not own deployment paths. */
export function createDataUrlResolver(dataRoot: string): DataUrlResolver {
  const root = dataRoot.endsWith('/') ? dataRoot : `${dataRoot}/`
  return (fileName) => `${root}${fileName}`
}
