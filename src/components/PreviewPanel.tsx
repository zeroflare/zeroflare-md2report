import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CaptionEntry, CoverMeta, TocEntry } from '../types'
import {
  captionToTocEntry,
  captionsByKind,
  extractCaptions,
  extractHeadings,
  renderMarkdown,
} from '../lib/markdown'
import {
  CONTENT_HEIGHT_PX,
  PAGE_BOTTOM_SAFETY_PX,
  TOC_BOTTOM_SAFETY_PX,
  mapIdsToPages,
  paginateHtml,
  type PageChunk,
} from '../lib/paginate'
import {
  measureAndPaginateToc,
  replaceTocChunksIfChanged,
} from '../lib/paginateToc'
import { CoverPage } from './CoverPage'
import { TocPage } from './TocPage'
import { ReportPages } from './ReportPages'
import './PreviewPanel.css'

interface PreviewPanelProps {
  meta: CoverMeta
  markdown: string
  onExportPdf: () => void
  onExportWord: () => void
  onResetSample: () => void
}

const ZOOM_MIN = 0.4
const ZOOM_MAX = 2
const ZOOM_STEP = 0.1

interface ZoomAnchor {
  contentX: number
  contentY: number
  mouseX: number
  mouseY: number
}

export function PreviewPanel({
  meta,
  markdown,
  onExportPdf,
  onExportWord,
  onResetSample,
}: PreviewPanelProps) {
  const measureRef = useRef<HTMLDivElement>(null)
  const measureTocRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scaleWrapRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<PageChunk[]>([{ html: '', pageNumber: 1 }])
  const [pageMap, setPageMap] = useState<Record<string, number>>({})
  const [headings, setHeadings] = useState<TocEntry[]>([])
  const [captions, setCaptions] = useState<CaptionEntry[]>([])
  const [tocChunks, setTocChunks] = useState<TocEntry[][]>([[]])
  const [tableTocChunks, setTableTocChunks] = useState<TocEntry[][]>([])
  const [figureTocChunks, setFigureTocChunks] = useState<TocEntry[][]>([])
  const [html, setHtml] = useState('')
  const [fitScale, setFitScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [stackSize, setStackSize] = useState({ width: 0, height: 0 })

  const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fitScale * zoom))
  const scaleRef = useRef(scale)
  const zoomRef = useRef(zoom)
  const fitScaleRef = useRef(fitScale)
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null)

  scaleRef.current = scale
  zoomRef.current = zoom
  fitScaleRef.current = fitScale

  useEffect(() => {
    setHeadings(extractHeadings(markdown))
    setCaptions(extractCaptions(markdown))
    setHtml(renderMarkdown(markdown))
  }, [markdown])

  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return

    el.innerHTML = html || '<p></p>'

    const sampleBody = stackRef.current?.querySelector('.page-body') as
      | HTMLElement
      | null
    const rawHeight = sampleBody?.clientHeight || CONTENT_HEIGHT_PX
    const contentHeight = Math.max(240, rawHeight - PAGE_BOTTOM_SAFETY_PX)

    const nextPages = paginateHtml(el, contentHeight)
    const ids = [
      ...headings.map((h) => h.id),
      ...captions.map((c) => c.id),
    ]
    const nextMap = mapIdsToPages(el, contentHeight, ids)

    setPages(nextPages.length ? nextPages : [{ html: '', pageNumber: 1 }])
    setPageMap(nextMap)
  }, [html, headings, captions])

  useLayoutEffect(() => {
    const stack = stackRef.current
    const measure = measureTocRef.current
    if (!stack || !measure) return

    const tocInner = stack.querySelector('.toc-inner') as HTMLElement | null
    let contentHeight = CONTENT_HEIGHT_PX - TOC_BOTTOM_SAFETY_PX
    if (tocInner) {
      const style = window.getComputedStyle(tocInner)
      const padY =
        (parseFloat(style.paddingTop) || 0) +
        (parseFloat(style.paddingBottom) || 0)
      // clientHeight includes padding; only the content box is usable for rows
      contentHeight = Math.max(
        200,
        tocInner.clientHeight - padY - TOC_BOTTOM_SAFETY_PX,
      )
    }
    const { tables, figures } = captionsByKind(captions)

    const nextToc = measureAndPaginateToc(
      measure,
      headings,
      pageMap,
      contentHeight,
      '目錄',
    )
    setTocChunks((prev) =>
      replaceTocChunksIfChanged(prev, nextToc.length ? nextToc : [[]]),
    )

    const nextTables = measureAndPaginateToc(
      measure,
      tables.map(captionToTocEntry),
      pageMap,
      contentHeight,
      '表目錄',
    )
    setTableTocChunks((prev) => replaceTocChunksIfChanged(prev, nextTables))

    const nextFigures = measureAndPaginateToc(
      measure,
      figures.map(captionToTocEntry),
      pageMap,
      contentHeight,
      '圖目錄',
    )
    setFigureTocChunks((prev) => replaceTocChunksIfChanged(prev, nextFigures))
  }, [headings, captions, pageMap])

  useLayoutEffect(() => {
    const stack = stackRef.current
    if (!stack) return

    function syncSize() {
      if (!stack) return
      setStackSize({
        width: stack.offsetWidth,
        height: stack.offsetHeight,
      })
    }

    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(stack)
    return () => ro.disconnect()
  }, [pages, tocChunks, tableTocChunks, figureTocChunks, headings, meta])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    function updateFit() {
      if (!container) return
      const padX = 40
      const padY = 40
      const availableW = container.clientWidth - padX
      const availableH = container.clientHeight - padY
      const pageWidth = 210 * (96 / 25.4)
      const pageHeight = 297 * (96 / 25.4)
      const byHeight = availableH / pageHeight
      const byWidth = availableW / pageWidth
      const next = Math.min(1, byHeight, byWidth)
      setFitScale(Number.isFinite(next) && next > 0 ? next : 1)
    }

    updateFit()
    const ro = new ResizeObserver(updateFit)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current
    const container = scrollRef.current
    const wrap = scaleWrapRef.current
    if (!anchor || !container || !wrap) return
    zoomAnchorRef.current = null

    const containerRect = container.getBoundingClientRect()
    const wrapRect = wrap.getBoundingClientRect()
    const pointX =
      wrapRect.left - containerRect.left + anchor.contentX * scaleRef.current
    const pointY =
      wrapRect.top - containerRect.top + anchor.contentY * scaleRef.current

    container.scrollLeft += pointX - anchor.mouseX
    container.scrollTop += pointY - anchor.mouseY
  }, [scale])

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX / Math.max(fitScale, 0.01), +(z + ZOOM_STEP).toFixed(2)))
  }, [fitScale])

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN / Math.max(fitScale, 0.01), +(z - ZOOM_STEP).toFixed(2)))
  }, [fitScale])

  const zoomReset = useCallback(() => {
    setZoom(1)
  }, [])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    function onWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      const wrap = scaleWrapRef.current
      if (!wrap || !container) return

      const fit = fitScaleRef.current
      const minZ = ZOOM_MIN / Math.max(fit, 0.01)
      const maxZ = ZOOM_MAX / Math.max(fit, 0.01)
      const direction = event.deltaY > 0 ? -1 : 1
      const intensity = Math.min(0.18, Math.max(0.04, Math.abs(event.deltaY) / 400))
      const nextZoom = Math.min(
        maxZ,
        Math.max(minZ, +(zoomRef.current + direction * intensity).toFixed(3)),
      )
      if (Math.abs(nextZoom - zoomRef.current) < 0.0005) return

      const containerRect = container.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      const mouseX = event.clientX - containerRect.left
      const mouseY = event.clientY - containerRect.top
      const contentX = (mouseX - (wrapRect.left - containerRect.left)) / scaleRef.current
      const contentY = (mouseY - (wrapRect.top - containerRect.top)) / scaleRef.current
      zoomAnchorRef.current = { contentX, contentY, mouseX, mouseY }
      setZoom(nextZoom)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  const zoomPercent = Math.round(scale * 100)

  return (
    <div className="preview-panel">
      <div className="preview-toolbar no-print">
        <div className="preview-toolbar-left">
          <div className="preview-zoom">
            <button
              type="button"
              className="preview-zoom-btn"
              onClick={zoomOut}
              disabled={scale <= ZOOM_MIN + 0.001}
              aria-label="縮小"
            >
              −
            </button>
            <button
              type="button"
              className="preview-zoom-pct"
              onClick={zoomReset}
              title="重設為適合整頁"
            >
              {zoomPercent}%
            </button>
            <button
              type="button"
              className="preview-zoom-btn"
              onClick={zoomIn}
              disabled={scale >= ZOOM_MAX - 0.001}
              aria-label="放大"
            >
              +
            </button>
          </div>
        </div>
        <div className="preview-export-actions">
          <button type="button" className="btn-export" onClick={onResetSample}>
            恢復範例
          </button>
          <button type="button" className="btn-export" onClick={onExportWord}>
            匯出 Word
          </button>
          <button type="button" className="btn-export" onClick={onExportPdf}>
            匯出 PDF
          </button>
        </div>
      </div>

      <div className="preview-scroll" ref={scrollRef}>
        <div
          className="preview-scale-wrap"
          ref={scaleWrapRef}
          style={{
            width: stackSize.width ? stackSize.width * scale : undefined,
            height: stackSize.height ? stackSize.height * scale : undefined,
          }}
        >
          <div
            className="preview-stack"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            ref={stackRef}
          >
            <CoverPage meta={meta} />
            {(tocChunks.length ? tocChunks : [[]]).map((chunk, index) => (
              <TocPage
                key={`toc-${index}`}
                entries={chunk}
                pageMap={pageMap}
                title={meta.title}
                subtitle={meta.subtitle}
                company={meta.company}
                headingTitle="目錄"
                showHeading={index === 0}
              />
            ))}
            {tableTocChunks.map((chunk, index) => (
              <TocPage
                key={`table-toc-${index}`}
                entries={chunk}
                pageMap={pageMap}
                title={meta.title}
                subtitle={meta.subtitle}
                company={meta.company}
                headingTitle="表目錄"
                showHeading={index === 0}
              />
            ))}
            {figureTocChunks.map((chunk, index) => (
              <TocPage
                key={`figure-toc-${index}`}
                entries={chunk}
                pageMap={pageMap}
                title={meta.title}
                subtitle={meta.subtitle}
                company={meta.company}
                headingTitle="圖目錄"
                showHeading={index === 0}
              />
            ))}
            <ReportPages
              pages={pages}
              title={meta.title}
              subtitle={meta.subtitle}
              company={meta.company}
              startPageNumber={1}
            />
          </div>
        </div>
      </div>

      <div className="measure-host report-prose" aria-hidden ref={measureRef} />
      <div className="measure-toc" aria-hidden ref={measureTocRef} />
    </div>
  )
}
