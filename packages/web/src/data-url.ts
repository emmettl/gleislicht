export function editionDataUrl(fileName: string): string {
  return `${import.meta.env.BASE_URL}data/${fileName}`
}
