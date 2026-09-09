// DOM support is scoped to *.dom.test.tsx; data/geometry tests stay in Node.
if (typeof window !== 'undefined') {
  window.matchMedia ??= () => ({ matches: false, media: '', onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })
  Element.prototype.scrollIntoView ??= function () {}
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open') }
}
