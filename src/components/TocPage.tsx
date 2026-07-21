import type { TocEntry } from '../types'
import './TocPage.css'

interface TocPageProps {
  entries: TocEntry[]
  pageMap: Record<string, number>
  title: string
  subtitle: string
  company: string
  /** Section title shown at top of the first page of this TOC */
  headingTitle?: string
  emptyMessage?: string
  /** Show the section title — only on the first page of this TOC */
  showHeading?: boolean
}

export function TocPage({
  entries,
  pageMap,
  title,
  subtitle,
  company,
  headingTitle = '目錄',
  emptyMessage = '尚無標題。請在 Markdown 使用 ##、###。',
  showHeading = true,
}: TocPageProps) {
  const headerTitle = (title || '報告標題').replace(/\s+/g, ' ').trim()
  const headerSubtitle = subtitle.replace(/\s+/g, ' ').trim()

  return (
    <article className="a4-page toc-page">
      <div className="page-frame">
        <header className="page-header">
          <span className="page-header-title">{headerTitle}</span>
          <span className="page-header-subtitle">{headerSubtitle}</span>
        </header>
        <div className="toc-inner">
          {showHeading ? <h1 className="toc-heading">{headingTitle}</h1> : null}
          {entries.length === 0 ? (
            <p className="toc-empty">{emptyMessage}</p>
          ) : (
            <ol className="toc-list">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className={`toc-item toc-level-${entry.level}`}
                >
                  <a className="toc-link" href={`#${entry.id}`}>
                    <span className="toc-text">{entry.text}</span>
                    <span className="toc-dots" aria-hidden />
                    <span className="toc-num">{pageMap[entry.id] ?? '—'}</span>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
        <footer className="page-footer">
          <span className="page-footer-company">{company || '公司名稱'}</span>
        </footer>
      </div>
    </article>
  )
}
