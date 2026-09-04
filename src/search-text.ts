const combiningMarks = /\p{Mark}+/gu

export function foldSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('de-CH')
    .normalize('NFD')
    .replace(combiningMarks, '')
    .replaceAll('ß', 'ss')
    .replaceAll('ae', 'a')
    .replaceAll('oe', 'o')
    .replaceAll('ue', 'u')
}
