import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  convertInchesToTwip,
} from 'docx'
import type { Tokens } from 'marked'
import { marked } from 'marked'
import type { CoverMeta } from '../types'
import { extractCaptions, extractHeadings, captionsByKind } from './markdown'

const FONT = '標楷體'
const BLACK = '000000'

function textRun(
  text: string,
  opts: { bold?: boolean; italics?: boolean; size?: number; break?: number } = {},
): TextRun {
  return new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italics,
    size: opts.size ?? 22,
    font: FONT,
    color: BLACK,
    break: opts.break,
  })
}

function inlineRuns(tokens: Tokens.Generic[] | undefined, bold = false): TextRun[] {
  if (!tokens?.length) return [textRun('')]
  const out: TextRun[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        out.push(textRun((token as Tokens.Text).text, { bold }))
        break
      case 'strong':
        out.push(...inlineRuns((token as Tokens.Strong).tokens, true))
        break
      case 'em':
        out.push(textRun((token as Tokens.Em).text, { bold, italics: true }))
        break
      case 'codespan':
        out.push(
          new TextRun({
            text: (token as Tokens.Codespan).text,
            bold,
            size: 20,
            font: 'Courier New',
            color: BLACK,
          }),
        )
        break
      case 'link':
        out.push(...inlineRuns((token as Tokens.Link).tokens, bold))
        break
      case 'br':
        out.push(textRun('', { break: 1 }))
        break
      case 'escape':
        out.push(textRun((token as Tokens.Escape).text, { bold }))
        break
      default: {
        const maybe = token as { text?: string }
        if (typeof maybe.text === 'string') out.push(textRun(maybe.text, { bold }))
        break
      }
    }
  }

  return out.length ? out : [textRun('')]
}

function listItemRuns(item: Tokens.ListItem): TextRun[] {
  const runs: TextRun[] = []
  for (const child of item.tokens) {
    if (child.type === 'paragraph') {
      runs.push(...inlineRuns((child as Tokens.Paragraph).tokens))
    } else if (child.type === 'text') {
      const t = child as Tokens.Text
      runs.push(...(t.tokens ? inlineRuns(t.tokens) : [textRun(t.text)]))
    }
  }
  return runs.length ? runs : [textRun(item.text)]
}

function tokenToParagraphs(token: Tokens.Generic): Paragraph[] {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading
      if (t.depth === 1) return []
      const level =
        t.depth === 2
          ? HeadingLevel.HEADING_1
          : t.depth === 3
            ? HeadingLevel.HEADING_2
            : t.depth === 4
              ? HeadingLevel.HEADING_3
              : t.depth === 5
                ? HeadingLevel.HEADING_4
                : HeadingLevel.HEADING_5
      return [
        new Paragraph({
          heading: level,
          spacing: { before: 280, after: 140 },
          border:
            t.depth === 2
              ? {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 12,
                    color: '555555',
                    space: 4,
                  },
                }
              : undefined,
          children: inlineRuns(t.tokens, true),
        }),
      ]
    }
    case 'paragraph': {
      const t = token as Tokens.Paragraph
      return [
        new Paragraph({
          spacing: { after: 160, line: 360 },
          children: inlineRuns(t.tokens),
        }),
      ]
    }
    case 'list': {
      const t = token as Tokens.List
      return t.items.map(
        (item, index) =>
          new Paragraph({
            spacing: { after: 80, line: 360 },
            indent: { left: convertInchesToTwip(0.25) },
            children: [
              textRun(t.ordered ? `${index + 1}. ` : '• '),
              ...listItemRuns(item),
            ],
          }),
      )
    }
    case 'blockquote': {
      const t = token as Tokens.Blockquote
      const paras: Paragraph[] = []
      for (const child of t.tokens) {
        if (child.type === 'paragraph') {
          paras.push(
            new Paragraph({
              spacing: { after: 120, line: 360 },
              indent: { left: convertInchesToTwip(0.2) },
              border: {
                left: {
                  style: BorderStyle.SINGLE,
                  size: 18,
                  color: 'C8A96E',
                  space: 8,
                },
              },
              children: inlineRuns((child as Tokens.Paragraph).tokens),
            }),
          )
        } else {
          paras.push(...tokenToParagraphs(child))
        }
      }
      return paras
    }
    case 'code': {
      const t = token as Tokens.Code
      return t.text.split('\n').map(
        (line) =>
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: line || ' ',
                size: 18,
                font: 'Courier New',
                color: BLACK,
              }),
            ],
          }),
      )
    }
    case 'space':
      return [new Paragraph({ children: [] })]
    case 'hr':
      return [
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: 'AAAAAA',
              space: 1,
            },
          },
          spacing: { before: 120, after: 120 },
          children: [],
        }),
      ]
    case 'html': {
      const raw = String((token as Tokens.HTML).text || token.raw || '')
      const pMatch = /<p\b([^>]*)>([\s\S]*?)<\/p>/i.exec(raw)
      if (!pMatch) return []
      const attrs = pMatch[1]
      const inner = pMatch[2]
      if (!/align\s*=\s*(["']?)center\1/i.test(attrs)) return []
      const text = inner
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (!text) return []
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 120 },
          children: [textRun(text, { bold: true })],
        }),
      ]
    }
    default:
      return []
  }
}

function coverParagraphs(meta: CoverMeta): Paragraph[] {
  const titleLines = (meta.title || '報告標題').split(/\n/).filter(Boolean)
  const subtitleLines = (meta.subtitle || '').split(/\n/).filter(Boolean)

  return [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    ...titleLines.map(
      (line, i) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: i === titleLines.length - 1 ? 200 : 80 },
          children: [textRun(line, { bold: true, size: 44 })],
        }),
    ),
    ...subtitleLines.map(
      (line) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [textRun(line, { bold: true, size: 32 })],
        }),
    ),
    new Paragraph({ spacing: { before: 2800 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [textRun(meta.company || '公司名稱', { bold: true, size: 26 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [textRun(meta.date || '', { bold: true, size: 26 })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

function tocParagraphs(markdown: string): Paragraph[] {
  const headings = extractHeadings(markdown)
  const { tables, figures } = captionsByKind(extractCaptions(markdown))
  const paras: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [textRun('目錄', { bold: true, size: 32 })],
    }),
  ]

  if (!headings.length) {
    paras.push(
      new Paragraph({
        children: [textRun('尚無標題。請在 Markdown 使用 ##、###。')],
      }),
    )
  } else {
    for (const entry of headings) {
      const indent =
        entry.level === 2
          ? convertInchesToTwip(0.2)
          : convertInchesToTwip(0.4)
      paras.push(
        new Paragraph({
          spacing: { after: 100 },
          indent: { left: indent },
          children: [textRun(entry.text, { bold: false })],
        }),
      )
    }
  }

  paras.push(new Paragraph({ children: [new PageBreak()] }))

  if (tables.length) {
    paras.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 280 },
        children: [textRun('表目錄', { bold: true, size: 32 })],
      }),
    )
    for (const entry of tables) {
      paras.push(
        new Paragraph({
          spacing: { after: 100 },
          indent: { left: convertInchesToTwip(0.2) },
          children: [textRun(entry.text, { bold: false })],
        }),
      )
    }
    paras.push(new Paragraph({ children: [new PageBreak()] }))
  }

  if (figures.length) {
    paras.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 280 },
        children: [textRun('圖目錄', { bold: true, size: 32 })],
      }),
    )
    for (const entry of figures) {
      paras.push(
        new Paragraph({
          spacing: { after: 100 },
          indent: { left: convertInchesToTwip(0.2) },
          children: [textRun(entry.text, { bold: false })],
        }),
      )
    }
    paras.push(new Paragraph({ children: [new PageBreak()] }))
  }

  return paras
}

function pageHeader(meta: CoverMeta): Header {
  const title = (meta.title || '報告標題').replace(/\s+/g, ' ').trim()
  const subtitle = (meta.subtitle || '').replace(/\s+/g, ' ').trim()

  return new Header({
    children: [
      new Paragraph({
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 12,
            color: '555555',
            space: 8,
          },
        },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          textRun(title, { bold: true, size: 18 }),
          new TextRun({ text: '\t', font: FONT }),
          textRun(subtitle, { bold: true, size: 18 }),
        ],
      }),
    ],
  })
}

function pageFooter(meta: CoverMeta, withPageNumber: boolean): Footer {
  return new Footer({
    children: [
      new Paragraph({
        border: {
          top: {
            style: BorderStyle.SINGLE,
            size: 18,
            color: '333333',
            space: 8,
          },
        },
        tabStops: [{ type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 }],
        children: withPageNumber
          ? [
              textRun(meta.company || '公司名稱', { bold: true, size: 18 }),
              new TextRun({ text: '\t', font: FONT }),
              new TextRun({
                children: [PageNumber.CURRENT],
                bold: true,
                size: 18,
                font: FONT,
                color: BLACK,
              }),
            ]
          : [textRun(meta.company || '公司名稱', { bold: true, size: 18 })],
      }),
    ],
  })
}

function safeFileName(meta: CoverMeta): string {
  const base = (meta.title || '報告').replace(/\s+/g, '').replace(/[\\/:*?"<>|]/g, '')
  return `${base || '報告'}.docx`
}

const pageMargin = {
  top: convertInchesToTwip(0.85),
  bottom: convertInchesToTwip(0.85),
  left: convertInchesToTwip(0.9),
  right: convertInchesToTwip(0.9),
}

export async function exportWord(meta: CoverMeta, markdown: string): Promise<void> {
  const tokens = marked.lexer(markdown)
  const body: Paragraph[] = []
  for (const token of tokens) {
    body.push(...tokenToParagraphs(token))
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22, color: BLACK },
          paragraph: { spacing: { line: 360 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 32, bold: true, color: BLACK },
          paragraph: { spacing: { before: 280, after: 140 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 26, bold: true, color: BLACK },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 24, bold: true, color: BLACK },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        {
          id: 'Heading4',
          name: 'Heading 4',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 22, bold: true, color: BLACK },
          paragraph: { spacing: { before: 180, after: 80 } },
        },
        {
          id: 'Heading5',
          name: 'Heading 5',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 20, bold: true, color: BLACK },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
        {
          id: 'Heading6',
          name: 'Heading 6',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 20, bold: true, color: BLACK },
          paragraph: { spacing: { before: 140, after: 60 } },
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: pageMargin } },
        children: coverParagraphs(meta),
      },
      {
        properties: { page: { margin: pageMargin } },
        headers: { default: pageHeader(meta) },
        footers: { default: pageFooter(meta, false) },
        children: tocParagraphs(markdown),
      },
      {
        properties: { page: { margin: pageMargin } },
        headers: { default: pageHeader(meta) },
        footers: { default: pageFooter(meta, true) },
        children: body.length ? body : [new Paragraph({ children: [textRun('')] })],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeFileName(meta)
  a.click()
  URL.revokeObjectURL(url)
}
