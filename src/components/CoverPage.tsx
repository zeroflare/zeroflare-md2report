import type { CoverMeta } from '../types'
import './CoverPage.css'

interface CoverPageProps {
  meta: CoverMeta
}

export function CoverPage({ meta }: CoverPageProps) {
  return (
    <article className="a4-page cover-page">
      <div className="cover-inner">
        <div className="cover-main">
          <h1 className="cover-title">{meta.title || '報告標題'}</h1>
          {meta.subtitle ? <p className="cover-subtitle">{meta.subtitle}</p> : null}
        </div>
        <div className="cover-bottom">
          <p className="cover-company">{meta.company || '公司名稱'}</p>
          <p className="cover-date">{meta.date || ''}</p>
        </div>
      </div>
    </article>
  )
}
