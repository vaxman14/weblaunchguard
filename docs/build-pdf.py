#!/usr/bin/env python3
"""Convert a Markdown file to a production-quality PDF using reportlab.

Handles: H1-H4, paragraphs, bullet/numbered lists, inline code, fenced code
blocks, tables (GFM), inline links, bold/italic. Page size US Letter.
"""

import sys
from html.parser import HTMLParser
from html import unescape

import markdown
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Preformatted,
    PageBreak,
    KeepTogether,
)
from reportlab.lib.enums import TA_LEFT


# ---------- Styles ---------------------------------------------------------

styles = getSampleStyleSheet()

base_font = "Helvetica"
mono_font = "Courier"

styles.add(
    ParagraphStyle(
        "BodyTextWLG",
        parent=styles["BodyText"],
        fontName=base_font,
        fontSize=10.5,
        leading=15,
        spaceAfter=8,
        alignment=TA_LEFT,
    )
)

styles.add(
    ParagraphStyle(
        "H1WLG",
        parent=styles["Heading1"],
        fontName=base_font + "-Bold",
        fontSize=22,
        leading=28,
        spaceBefore=18,
        spaceAfter=10,
        textColor=colors.HexColor("#0f172a"),
    )
)

styles.add(
    ParagraphStyle(
        "H2WLG",
        parent=styles["Heading2"],
        fontName=base_font + "-Bold",
        fontSize=16,
        leading=22,
        spaceBefore=18,
        spaceAfter=8,
        textColor=colors.HexColor("#1e293b"),
        borderPadding=(0, 0, 4, 0),
    )
)

styles.add(
    ParagraphStyle(
        "H3WLG",
        parent=styles["Heading3"],
        fontName=base_font + "-Bold",
        fontSize=13,
        leading=18,
        spaceBefore=14,
        spaceAfter=6,
        textColor=colors.HexColor("#334155"),
    )
)

styles.add(
    ParagraphStyle(
        "H4WLG",
        parent=styles["Heading4"],
        fontName=base_font + "-Bold",
        fontSize=11.5,
        leading=15,
        spaceBefore=10,
        spaceAfter=4,
        textColor=colors.HexColor("#475569"),
    )
)

styles.add(
    ParagraphStyle(
        "ListItemWLG",
        parent=styles["BodyText"],
        fontName=base_font,
        fontSize=10.5,
        leading=14,
        leftIndent=18,
        bulletIndent=4,
        spaceAfter=2,
    )
)

styles.add(
    ParagraphStyle(
        "CodeWLG",
        parent=styles["Code"],
        fontName=mono_font,
        fontSize=8.5,
        leading=11,
        leftIndent=6,
        rightIndent=6,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f1f5f9"),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5,
        borderPadding=(6, 6, 6, 6),
        spaceBefore=6,
        spaceAfter=10,
    )
)

styles.add(
    ParagraphStyle(
        "TableCellWLG",
        parent=styles["BodyText"],
        fontName=base_font,
        fontSize=9,
        leading=12,
    )
)

styles.add(
    ParagraphStyle(
        "TableHeaderWLG",
        parent=styles["BodyText"],
        fontName=base_font + "-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.white,
    )
)


# ---------- HTML → Platypus ------------------------------------------------


def html_inline_to_rl(fragment: str) -> str:
    """Convert markdown's inline HTML to reportlab paragraph markup."""
    out = fragment
    out = out.replace("<strong>", "<b>").replace("</strong>", "</b>")
    out = out.replace("<em>", "<i>").replace("</em>", "</i>")
    # <code> → mono with light bg
    out = out.replace("<code>", '<font face="Courier" size="9.5"><font backColor="#f1f5f9">')
    out = out.replace("</code>", "</font></font>")
    # links: keep visible underline + color via reportlab markup
    # markdown produces <a href="...">text</a>
    import re

    def link(match):
        href = match.group(1)
        text = match.group(2)
        return f'<link href="{href}" color="#1d4ed8"><u>{text}</u></link>'

    out = re.sub(r'<a href="([^"]+)">([^<]+)</a>', link, out)
    # strip stray br tags
    out = out.replace("<br>", "<br/>")
    return out


class MarkdownPdfBuilder(HTMLParser):
    def __init__(self):
        super().__init__()
        self.story = []
        self.buffer = ""
        self.tag_stack = []
        # Table state
        self.in_table = False
        self.table_rows = []
        self.current_row = []
        self.current_cell = ""
        self.cell_is_header = False
        # List state
        self.list_stack = []  # entries: ("ul"|"ol", index)
        # Code block state
        self.in_pre = False
        self.code_buffer = ""

    def emit_paragraph(self, style_name="BodyTextWLG"):
        text = self.buffer.strip()
        self.buffer = ""
        if not text:
            return
        text = html_inline_to_rl(text)
        self.story.append(Paragraph(text, styles[style_name]))

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        if tag in ("h1", "h2", "h3", "h4"):
            self.tag_stack.append(tag)
        elif tag == "p":
            self.tag_stack.append(tag)
        elif tag in ("ul", "ol"):
            self.list_stack.append((tag, 0))
        elif tag == "li":
            self.tag_stack.append("li")
        elif tag == "pre":
            self.in_pre = True
            self.code_buffer = ""
        elif tag == "code" and self.in_pre:
            pass  # contents handled by handle_data
        elif tag == "code":
            self.buffer += "<code>"
        elif tag in ("strong", "b"):
            self.buffer += "<strong>"
        elif tag in ("em", "i"):
            self.buffer += "<em>"
        elif tag == "a":
            href = attr.get("href", "")
            self.buffer += f'<a href="{href}">'
        elif tag == "table":
            self.in_table = True
            self.table_rows = []
        elif tag == "tr":
            self.current_row = []
        elif tag in ("th", "td"):
            self.cell_is_header = tag == "th"
            self.current_cell = ""
        elif tag == "br":
            self.buffer += "<br/>"
        elif tag == "hr":
            from reportlab.platypus import HRFlowable
            self.story.append(Spacer(1, 6))
            self.story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1")))
            self.story.append(Spacer(1, 6))

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "h4"):
            style = {"h1": "H1WLG", "h2": "H2WLG", "h3": "H3WLG", "h4": "H4WLG"}[tag]
            self.emit_paragraph(style)
            if self.tag_stack and self.tag_stack[-1] == tag:
                self.tag_stack.pop()
        elif tag == "p":
            if not self.in_table and not self.list_stack:
                self.emit_paragraph("BodyTextWLG")
            if self.tag_stack and self.tag_stack[-1] == "p":
                self.tag_stack.pop()
        elif tag in ("ul", "ol"):
            if self.list_stack:
                self.list_stack.pop()
        elif tag == "li":
            text = self.buffer.strip()
            self.buffer = ""
            if text:
                text = html_inline_to_rl(text)
                if self.list_stack:
                    list_type, idx = self.list_stack[-1]
                    if list_type == "ol":
                        idx += 1
                        self.list_stack[-1] = (list_type, idx)
                        bullet = f"{idx}."
                    else:
                        bullet = "•"  # actual bullet character
                    self.story.append(
                        Paragraph(text, styles["ListItemWLG"], bulletText=bullet)
                    )
            if self.tag_stack and self.tag_stack[-1] == "li":
                self.tag_stack.pop()
        elif tag == "pre":
            self.in_pre = False
            code = self.code_buffer.rstrip()
            self.code_buffer = ""
            if code:
                self.story.append(Preformatted(code, styles["CodeWLG"]))
        elif tag == "code" and not self.in_pre:
            self.buffer += "</code>"
        elif tag in ("strong", "b"):
            self.buffer += "</strong>"
        elif tag in ("em", "i"):
            self.buffer += "</em>"
        elif tag == "a":
            self.buffer += "</a>"
        elif tag == "table":
            self.in_table = False
            self.flush_table()
        elif tag == "tr":
            if self.current_row:
                self.table_rows.append(self.current_row)
            self.current_row = []
        elif tag in ("th", "td"):
            cell_text = html_inline_to_rl(self.current_cell.strip())
            style = "TableHeaderWLG" if self.cell_is_header else "TableCellWLG"
            self.current_row.append(Paragraph(cell_text or "&nbsp;", styles[style]))
            self.current_cell = ""

    def handle_data(self, data):
        if self.in_pre:
            self.code_buffer += data
            return
        if self.in_table:
            self.current_cell += data
            return
        # Escape characters that confuse reportlab paragraph markup
        safe = data.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        # But we already emit our own tags into the buffer — don't double-escape
        # those. Easier: only escape data that arrives as raw text.
        self.buffer += safe

    def handle_entityref(self, name):
        self.buffer += f"&{name};"

    def handle_charref(self, name):
        self.buffer += f"&#{name};"

    def flush_table(self):
        if not self.table_rows:
            return
        col_count = max(len(r) for r in self.table_rows)
        # Pad rows to equal length
        for r in self.table_rows:
            while len(r) < col_count:
                r.append(Paragraph("&nbsp;", styles["TableCellWLG"]))

        # Choose column widths: distribute evenly across content area
        content_width = LETTER[0] - 1.4 * inch  # margins
        col_width = content_width / col_count

        tbl = Table(self.table_rows, colWidths=[col_width] * col_count, repeatRows=1)
        style = TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), base_font + "-Bold"),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
        tbl.setStyle(style)
        self.story.append(Spacer(1, 4))
        self.story.append(tbl)
        self.story.append(Spacer(1, 8))


def page_decoration(canvas, doc):
    canvas.saveState()
    canvas.setFont(base_font, 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    # Footer
    page_num = canvas.getPageNumber()
    footer = f"Web Launch Guard — Production Launch Manual    |    Page {page_num}"
    canvas.drawString(0.7 * inch, 0.5 * inch, footer)
    canvas.restoreState()


def build_pdf(md_path: str, pdf_path: str) -> None:
    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    html = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists"],
    )

    builder = MarkdownPdfBuilder()
    builder.feed(html)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=LETTER,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title="Web Launch Guard — Production Launch Manual",
        author="CTFDigital",
    )
    doc.build(builder.story, onFirstPage=page_decoration, onLaterPages=page_decoration)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: md_to_pdf.py <input.md> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    build_pdf(sys.argv[1], sys.argv[2])
    print(f"wrote {sys.argv[2]}")
