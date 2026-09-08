import { useUiText } from '../use-ui-text.ts'
import { type UiLanguage } from '../i18n.ts'
import './alpine-quiet.css'

export function AlpineQuiet({ language }: { language: UiLanguage }) {
  const text = useUiText(language)
  return (
    <section className="alpine-quiet" role="status">
      <svg className="alpine-quiet__drawing" viewBox="0 0 600 300" fill="none" aria-hidden="true">
        <g className="alpine-quiet__stars" fill="currentColor">
          <circle cx="105" cy="92" r="1.5" /><circle cx="193" cy="39" r="1" />
          <circle cx="331" cy="25" r="1.5" /><circle cx="501" cy="84" r="1" />
          <circle cx="464" cy="149" r="1.5" /><circle cx="66" cy="164" r="1" />
        </g>
        <g className="alpine-quiet__moon">
          <circle cx="421" cy="65" r="28" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="421" cy="65" r="39" stroke="currentColor" strokeWidth="0.4" opacity="0.25" />
          <path d="M421 53V77M409 65H433" stroke="currentColor" strokeWidth="5" />
        </g>
        <path className="alpine-quiet__ridge-back" d="M32 245L129 147L184 201L254 124L330 207L418 135L562 245" />
        <path className="alpine-quiet__ridge" d="M70 250L173 222L247 138L291 56L319 78L353 170L401 218L531 250" />
        <path className="alpine-quiet__snow" d="M247 138L271 126L283 137L301 112L327 131M291 56L301 112L319 78" />
        <path className="alpine-quiet__facets" d="M301 112L312 173L353 218M283 137L265 192L226 242M319 78L331 153L401 218M103 261Q300 277 501 261M161 273Q300 284 443 273" />
        <path className="alpine-quiet__cable" d="M131 174L421 214" />
        <g className="alpine-quiet__gondola">
          <path d="M-5 0H5M0 0V13" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-11" y="13" width="22" height="23" rx="5" fill="#c73650" stroke="#ffafb9" />
          <path d="M-7 18H7V23H-7Z" fill="#17162d" />
          <path d="M0 27V33M-3 30H3" stroke="#fff5ee" strokeWidth="2" />
        </g>
      </svg>
      <h2>{text.quietTitle}</h2>
      <p>{text.quietDescription}</p>
      <small>{text.quietHint}</small>
    </section>
  )
}
