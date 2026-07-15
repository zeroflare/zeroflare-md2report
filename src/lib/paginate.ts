/** Fallback content area height ≈ framed A4 body at 96dpi */
export const CONTENT_HEIGHT_PX = 880

/** Leave room so last block (tables) never sits under the footer rule */
export const PAGE_BOTTOM_SAFETY_PX = 40

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
 * Pack nodes onto pages. Never leave a heading stranded alone at the bottom —
 * move it to the next page together with the following block.
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

  for (const node of nodes) {
    const height = elementBlockHeight(node)
    const pageEmpty = page.length === 0

    if (!pageEmpty && currentHeight + height > contentHeightPx) {
      const moved: HTMLElement[] = []
      while (page.length > 0 && isHeading(page[page.length - 1])) {
        moved.unshift(page.pop()!)
      }
      if (page.length === 0) {
        pages.pop()
      }
      pages.push([...moved, node])
      page = pages[pages.length - 1]
      currentHeight = groupHeight(page)
    } else {
      page.push(node)
      currentHeight += height
    }
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
    const startsWithH2 = group[0]?.tagName === 'H2'

    // Each H2 section begins on its own page (Appendix C included)
    if (startsWithH2 && !pageEmpty) {
      if (height <= contentHeightPx) {
        pages.push([...group])
        continue
      }
      appendNodesToPages(pages, group, contentHeightPx, true)
      continue
    }

    // Preamble / empty page
    if (height <= contentHeightPx) {
      page.push(...group)
      continue
    }

    appendNodesToPages(pages, group, contentHeightPx, !pageEmpty)
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
 * Estimate which body page number each heading id falls on,
 * using the same measurement container.
 */
export function mapHeadingsToPages(
  container: HTMLElement,
  contentHeightPx: number,
  headingIds: string[],
): Record<string, number> {
  const children = Array.from(container.children) as HTMLElement[]
  const pages = splitIntoPages(children, contentHeightPx)
  const result: Record<string, number> = {}

  pages.forEach((nodes, index) => {
    const pageNumber = index + 1
    for (const node of nodes) {
      if (node.id && headingIds.includes(node.id)) {
        result[node.id] = pageNumber
      }
    }
  })

  for (const id of headingIds) {
    if (!(id in result)) result[id] = 1
  }

  return result
}
