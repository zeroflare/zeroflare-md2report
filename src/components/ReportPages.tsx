import type { ReactNode } from 'react'
import type { PageChunk } from '../lib/paginate'
import './ReportPages.css'

interface ReportPagesProps {
  pages: PageChunk[]
  title: string
  subtitle: string
  company: string
  /** Absolute page number for the first body page (after cover + TOC) */
  startPageNumber: number
}

function PageChrome({
  title,
  subtitle,
  company,
  pageNumber,
  children,
}: {
  title: string
  subtitle: string
  company: string
  pageNumber: number
  children: ReactNode
}) {
  const headerTitle = (title || '報告標題').replace(/\s+/g, ' ').trim()
  const headerSubtitle = subtitle.replace(/\s+/g, ' ').trim()

  return (
    <article className="a4-page report-page">
      <div className="page-frame">
        <header className="page-header">
          <span className="page-header-title">{headerTitle}</span>
          <span className="page-header-subtitle">{headerSubtitle}</span>
        </header>
        {children}
        <footer className="page-footer">
          <span className="page-footer-company">{company || '公司名稱'}</span>
          <span className="page-number">{pageNumber}</span>
          <span className="page-footer-balance" aria-hidden />
        </footer>
      </div>
    </article>
  )
}

export function ReportPages({
  pages,
  title,
  subtitle,
  company,
  startPageNumber,
}: ReportPagesProps) {
  if (pages.length === 0) {
    return (
      <PageChrome
        title={title}
        subtitle={subtitle}
        company={company}
        pageNumber={startPageNumber}
      >
        <div className="page-body report-prose">
          <p className="report-placeholder">在左側輸入 Markdown 以產生報告內容。</p>
        </div>
      </PageChrome>
    )
  }

  return (
    <>
      {pages.map((page, index) => {
        const pageNumber = startPageNumber + index
        return (
          <PageChrome
            key={pageNumber}
            title={title}
            subtitle={subtitle}
            company={company}
            pageNumber={pageNumber}
          >
            <div
              className="page-body report-prose"
              dangerouslySetInnerHTML={{ __html: page.html }}
            />
          </PageChrome>
        )
      })}
    </>
  )
}
