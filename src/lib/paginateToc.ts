import type { TocEntry } from '../types'

/**
 * Pack TOC entries into pages by measured heights.
 * First page reserves space for the section heading (e.g.「目錄」).
 */
export function paginateTocEntries(
  entries: TocEntry[],
  contentHeightPx: number,
  headingHeightPx: number,
  itemHeightsPx: number[],
  gapPx: number,
): TocEntry[][] {
  if (entries.length === 0) return [[]]

  const pages: TocEntry[][] = []
  let current: TocEntry[] = []
  let used = headingHeightPx

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const itemH = itemHeightsPx[i] ?? 24
    const gap = current.length > 0 ? gapPx : 0
    const need = gap + itemH

    if (current.length > 0 && used + need > contentHeightPx) {
      pages.push(current)
      current = [entry]
      used = itemH
    } else {
      current.push(entry)
      used += need
    }
  }

  if (current.length) pages.push(current)
  return pages.length ? pages : [[]]
}

/** Measure TOC list item heights in a host element and pack into pages. */
export function measureAndPaginateToc(
  measure: HTMLElement,
  entries: TocEntry[],
  pageMap: Record<string, number>,
  contentHeightPx: number,
  headingTitle: string,
): TocEntry[][] {
  if (entries.length === 0) return []

  measure.innerHTML = ''
  const heading = document.createElement('h1')
  heading.className = 'toc-heading'
  heading.textContent = headingTitle
  measure.appendChild(heading)

  const list = document.createElement('ol')
  list.className = 'toc-list'
  for (const entry of entries) {
    const li = document.createElement('li')
    li.className = `toc-item toc-level-${entry.level}`
    const link = document.createElement('a')
    link.className = 'toc-link'
    const text = document.createElement('span')
    text.className = 'toc-text'
    text.textContent = entry.text
    const dots = document.createElement('span')
    dots.className = 'toc-dots'
    dots.setAttribute('aria-hidden', 'true')
    const num = document.createElement('span')
    num.className = 'toc-num'
    num.textContent = String(pageMap[entry.id] ?? '—')
    link.append(text, dots, num)
    li.appendChild(link)
    list.appendChild(li)
  }
  measure.appendChild(list)

  const headingStyle = window.getComputedStyle(heading)
  const headingH =
    heading.offsetHeight +
    (parseFloat(headingStyle.marginTop) || 0) +
    (parseFloat(headingStyle.marginBottom) || 0)
  const gapPx =
    parseFloat(
      window.getComputedStyle(list).rowGap || window.getComputedStyle(list).gap,
    ) || 0
  const itemHeights = Array.from(list.children).map(
    (node) => (node as HTMLElement).offsetHeight,
  )

  return paginateTocEntries(
    entries,
    contentHeightPx,
    headingH,
    itemHeights,
    gapPx,
  )
}

export function replaceTocChunksIfChanged(
  prev: TocEntry[][],
  next: TocEntry[][],
): TocEntry[][] {
  const same =
    prev.length === next.length &&
    prev.every(
      (chunk, i) =>
        chunk.length === next[i].length &&
        chunk.every((entry, j) => entry.id === next[i][j].id),
    )
  return same ? prev : next
}
