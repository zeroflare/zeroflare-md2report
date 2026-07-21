import { marked } from 'marked'
import type { CaptionEntry, TocEntry } from '../types'

marked.setOptions({
  gfm: true,
  breaks: false,
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    || 'heading'
}

function uniqueId(base: string, seen: Map<string, number>): string {
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count > 0 ? `${base}-${count}` : base
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
}

function stripTags(html: string): string {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

/** Inner HTML may only contain text and simple inline tags. */
function isPureTextHtml(inner: string): boolean {
  const withoutInline = inner.replace(
    /<\/?(?:strong|b|em|i|span|u|br)\b[^>]*>/gi,
    '',
  )
  return !/<[^>]+>/.test(withoutInline)
}

function hasAlignCenter(attrs: string): boolean {
  return /align\s*=\s*(["']?)center\1/i.test(attrs)
}

/**
 * Find `<p align="center">…</p>` whose plain text starts with 表 / 圖.
 * Used for 表目錄 / 圖目錄.
 */
export function extractCaptions(markdown: string): CaptionEntry[] {
  const entries: CaptionEntry[] = []
  const seen = new Map<string, number>()
  const re = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(markdown)) !== null) {
    const attrs = match[1]
    const inner = match[2]
    if (!hasAlignCenter(attrs)) continue
    if (!isPureTextHtml(inner)) continue

    const text = stripTags(inner)
    if (!text) continue

    let kind: CaptionEntry['kind'] | null = null
    if (text.startsWith('表')) kind = 'table'
    else if (text.startsWith('圖')) kind = 'figure'
    else continue

    const prefix = kind === 'table' ? 'table' : 'figure'
    const id = uniqueId(`${prefix}-${slugify(text)}`, seen)
    entries.push({ id, text, kind })
  }

  return entries
}

export function captionsByKind(captions: CaptionEntry[]): {
  tables: CaptionEntry[]
  figures: CaptionEntry[]
} {
  return {
    tables: captions.filter((c) => c.kind === 'table'),
    figures: captions.filter((c) => c.kind === 'figure'),
  }
}

export function captionToTocEntry(caption: CaptionEntry): TocEntry {
  return { id: caption.id, text: caption.text, level: 2 }
}

/** TOC includes `##` / `###` only — `#` is omitted from TOC and body. */
export function extractHeadings(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  const seen = new Map<string, number>()
  const lines = markdown.split('\n')

  for (const line of lines) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line)
    if (!match) continue
    const level = match[1].length as 2 | 3
    const text = match[2].replace(/#+\s*$/, '').trim()
    if (!text) continue

    const id = uniqueId(slugify(text), seen)
    entries.push({ id, text, level })
  }

  return entries
}

function enhanceCaptionAnchors(html: string, captions: CaptionEntry[]): string {
  if (!captions.length || typeof document === 'undefined') return html

  const container = document.createElement('div')
  container.innerHTML = html
  let index = 0

  for (const p of container.querySelectorAll('p')) {
    if (index >= captions.length) break

    const align = (p.getAttribute('align') || '').toLowerCase()
    const style = p.getAttribute('style') || ''
    const centered =
      align === 'center' || /text-align\s*:\s*center/i.test(style)
    if (!centered) continue
    if (!isPureTextHtml(p.innerHTML)) continue

    const text = (p.textContent || '').replace(/\s+/g, ' ').trim()
    const caption = captions[index]
    const want = caption.kind === 'table' ? '表' : '圖'
    if (!text.startsWith(want)) continue

    p.id = caption.id
    p.classList.add('report-caption')
    index += 1
  }

  return container.innerHTML
}

export function renderMarkdown(markdown: string): string {
  const headings = extractHeadings(markdown)
  const captions = extractCaptions(markdown)
  let headingIndex = 0

  const renderer = new marked.Renderer()
  const originalHeading = renderer.heading.bind(renderer)

  renderer.heading = function (token) {
    const level = token.depth
    // Hide document H1 — cover already carries the report title
    if (level === 1) return ''
    if (level >= 2 && level <= 3 && headingIndex < headings.length) {
      const entry = headings[headingIndex]
      headingIndex += 1
      const text = this.parser.parseInline(token.tokens)
      return `<h${level} id="${entry.id}">${text}</h${level}>\n`
    }
    return originalHeading(token)
  }

  let html = marked.parse(markdown, { renderer }) as string
  html = enhanceTableCellWrapping(html)
  html = enhanceCaptionAnchors(html, captions)
  return html
}

/**
 * Short table cells (e.g. "Malicious", "MpClient.dll") stay on one line.
 * Cells with long unbroken tokens (hashes, URLs) are allowed to break.
 */
function enhanceTableCellWrapping(html: string): string {
  if (typeof document === 'undefined') return html

  const container = document.createElement('div')
  container.innerHTML = html

  for (const td of container.querySelectorAll('td')) {
    const text = (td.textContent ?? '').trim()
    if (!text) continue

    if (/[^\s]{28,}/.test(text)) {
      td.classList.add('cell-break-long')
      continue
    }

    const words = text.split(/\s+/).filter(Boolean)
    if (text.length <= 28 && words.length <= 4) {
      td.classList.add('cell-nowrap')
    }
  }

  return container.innerHTML
}

export const SAMPLE_MARKDOWN = `# 國家資通安全研究院資安顧問案

本報告說明 **Zeroflare MD2Report** 的使用方式與設計原則。將 Markdown 即時轉換為具備封面、目錄與頁碼的 A4 報告。

## 目標對象

本工具適合需要快速產出正式文件的團隊，包括：

- 產品經理撰寫需求規格
- 工程師整理技術設計文件
- 顧問輸出客戶報告

## 核心功能

### 封面資訊

使用者可自訂標題、副標題、公司名稱與日期。封面獨立成頁。

### 自動目錄

系統會掃描 Markdown 中的 \`##\`／\`###\` 標題，自動建立目錄，並標示對應頁碼。\`#\` 不會出現在目錄與內文（封面另有標題）。

置中且以「表」「圖」開頭的說明（例如 \`<p align="center"><strong>表 1　範例</strong></p>\`）會分別進入表目錄與圖目錄。

### 分頁與頁碼

內文依 A4 內容區高度自動切頁。每頁頁首顯示公司名稱，頁碼由封面起連續計算。

## 撰寫指引

### Markdown 結構建議

建議以 \`##\` 作為章節、\`###\` 作為細節說明。全文開頭的 \`#\` 可省略，不會顯示於報告內文。

### 列表與強調

- 條列可突顯重點
- **粗體** 用於關鍵名詞
- \`程式碼\` 用於指令或欄位名稱

## 匯出 PDF

編輯完成後，點選「匯出 PDF」，在列印對話框中選擇「儲存為 PDF」即可下載完整報告。

## 結語

透過左側即時編輯與右側 A4 預覽，可在撰寫同時掌握最終列印效果，減少來回調整的成本。
`
