/** Fallback content area height ≈ framed A4 body at 96dpi */
export const CONTENT_HEIGHT_PX = 880

/** Leave room so last block (tables) never sits under the footer rule */
export const PAGE_BOTTOM_SAFETY_PX = 40

/** Small clearance after subtracting toc-inner padding (measurement vs print) */
export const TOC_BOTTOM_SAFETY_PX = 12

export interface PageChunk {
  html: string
  pageNumber: number
}

function elementBlockHeight(el: HTMLElement): number {
  const style = window.getComputedStyle(el)
  const marginTop = parseFloat(style.marginTop) || 0
  const marginBottom = parseFloat(style.marginBottom) || 0
  // scrollHeight catches wrapped table / long-hash cells better than offsetHeight
  const box = Math.max(el.offsetHeight, el.scrollHeight)
  return box + marginTop + marginBottom
}

function groupHeight(nodes: HTMLElement[]): number {
  return nodes.reduce((sum, node) => sum + elementBlockHeight(node), 0)
}

function isHeading(el: HTMLElement): boolean {
  return /^H[1-6]$/.test(el.tagName)
}

function isTable(el: HTMLElement): boolean {
  return el.tagName === 'TABLE'
}

/** Centered 表/圖 caption that should stay with the following table. */
function isTableCaption(el: HTMLElement): boolean {
  if (el.classList.contains('report-caption')) return true
  if (el.tagName !== 'P') return false
  const align = (el.getAttribute('align') || '').toLowerCase()
  const style = el.getAttribute('style') || ''
  const centered =
    align === 'center' || /text-align\s*:\s*center/i.test(style)
  if (!centered) return false
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
  return text.startsWith('表') || text.startsWith('圖')
}

function shouldKeepWithPageEnd(el: HTMLElement): boolean {
  return isHeading(el) || isTableCaption(el)
}

/**
 * Caption + following table form one unit so they are not split across pages.
 * If the pair is taller than one page, fall back to single nodes.
 */
function nextPackUnit(
  nodes: HTMLElement[],
  start: number,
  contentHeightPx: number,
): HTMLElement[] {
  const first = nodes[start]
  if (!first) return []

  if (
    isTableCaption(first) &&
    start + 1 < nodes.length &&
    isTable(nodes[start + 1])
  ) {
    const pair = [first, nodes[start + 1]]
    if (groupHeight(pair) <= contentHeightPx) return pair
  }

  return [first]
}

/**
 * Group content so each H2 owns the following nodes until the next H2.
 * Content before the first H2 is its own preamble group.
 */
function groupByH2(children: HTMLElement[]): HTMLElement[][] {
  if (children.length === 0) return [[]]

  const groups: HTMLElement[][] = []
  let current: HTMLElement[] = []

  for (const child of children) {
    if (child.tagName === 'H2' && current.length > 0) {
      groups.push(current)
      current = [child]
    } else {
      current.push(child)
    }
  }

  if (current.length) groups.push(current)
  return groups
}

/**
 * Pack content onto pages by height. Multiple H2 sections may share a page
 * when they fit; only start a new page when the next block would overflow.
 * Avoid leaving a heading or table caption stranded at the bottom of a page.
 */
function appendNodesToPages(
  pages: HTMLElement[][],
  nodes: HTMLElement[],
  contentHeightPx: number,
  startOnFreshPage: boolean,
): void {
  if (startOnFreshPage && pages[pages.length - 1].length > 0) {
    pages.push([])
  }

  let page = pages[pages.length - 1]
  let currentHeight = groupHeight(page)
  let i = 0

  while (i < nodes.length) {
    const unit = nextPackUnit(nodes, i, contentHeightPx)
    const height = groupHeight(unit)
    const pageEmpty = page.length === 0

    if (!pageEmpty && currentHeight + height > contentHeightPx) {
      const moved: HTMLElement[] = []
      while (page.length > 0 && shouldKeepWithPageEnd(page[page.length - 1])) {
        moved.unshift(page.pop()!)
      }
      if (page.length === 0) {
        pages.pop()
      }
      pages.push([...moved, ...unit])
      page = pages[pages.length - 1]
      currentHeight = groupHeight(page)
    } else {
      page.push(...unit)
      currentHeight += height
    }

    i += unit.length
  }
}

function splitIntoPages(
  children: HTMLElement[],
  contentHeightPx: number,
): HTMLElement[][] {
  if (children.length === 0) return [[]]

  const groups = groupByH2(children)
  const pages: HTMLElement[][] = [[]]

  for (const group of groups) {
    const height = groupHeight(group)
    const page = pages[pages.length - 1]
    const pageEmpty = page.length === 0
    const used = groupHeight(page)

    // Whole section fits on the current page — keep it there (even with other H2s)
    if (pageEmpty || used + height <= contentHeightPx) {
      page.push(...group)
      continue
    }

    // Does not fit here: move to a fresh page, splitting only if taller than one page
    if (height <= contentHeightPx) {
      pages.push([...group])
      continue
    }

    appendNodesToPages(pages, group, contentHeightPx, true)
  }

  return pages.filter((p, i) => p.length > 0 || i === 0)
}

/**
 * Split rendered HTML into page-sized chunks by measuring element heights
 * against the printable content area.
 */
export function paginateHtml(
  container: HTMLElement,
  contentHeightPx: number,
): PageChunk[] {
  const children = Array.from(container.children) as HTMLElement[]
  const pages = splitIntoPages(children, contentHeightPx)

  return pages.map((nodes, i) => ({
    html: nodes.map((n) => n.outerHTML).join(''),
    pageNumber: i + 1,
  }))
}

/**
 * Estimate which body page number each element id falls on,
 * using the same measurement container.
 */
export function mapIdsToPages(
  container: HTMLElement,
  contentHeightPx: number,
  ids: string[],
): Record<string, number> {
  const children = Array.from(container.children) as HTMLElement[]
  const pages = splitIntoPages(children, contentHeightPx)
  const result: Record<string, number> = {}
  const idSet = new Set(ids)

  pages.forEach((nodes, index) => {
    const pageNumber = index + 1
    for (const node of nodes) {
      if (node.id && idSet.has(node.id)) {
        result[node.id] = pageNumber
      }
      for (const el of node.querySelectorAll('[id]')) {
        if (el.id && idSet.has(el.id)) {
          result[el.id] = pageNumber
        }
      }
    }
  })

  for (const id of ids) {
    if (!(id in result)) result[id] = 1
  }

  return result
}

/** @deprecated use mapIdsToPages */
export function mapHeadingsToPages(
  container: HTMLElement,
  contentHeightPx: number,
  headingIds: string[],
): Record<string, number> {
  return mapIdsToPages(container, contentHeightPx, headingIds)
}
