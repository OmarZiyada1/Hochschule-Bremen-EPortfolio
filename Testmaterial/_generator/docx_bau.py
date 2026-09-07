# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine fuer die Word-Druckvorlagen."""
import html, re
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

FUSS = "Bachelorarbeit E-Portfolio Hochschule Bremen, Fakultät 4"


def txt(s):
    """HTML-Entities aufloesen und Tags entfernen."""
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(s)


def neues_dokument(querformat=False):
    d = Document()
    st = d.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(11)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    for s in d.sections:
        if querformat:
            s.orientation = WD_ORIENT.LANDSCAPE
            s.page_width, s.page_height = s.page_height, s.page_width
        s.top_margin = Cm(1.8)
        s.bottom_margin = Cm(1.6)
        s.left_margin = Cm(2.0)
        s.right_margin = Cm(2.0)
        p = s.footer.paragraphs[0]
        p.text = FUSS
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in p.runs:
            r.font.size = Pt(8)
            r.font.color.rgb = RGBColor(0x77, 0x77, 0x77)
    return d


def titel(d, text, unter=None):
    p = d.add_paragraph()
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(16)
    p.space_after = Pt(2)
    if unter:
        q = d.add_paragraph()
        s = q.add_run(unter)
        s.font.size = Pt(9.5)
        s.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
        q.space_after = Pt(10)
    return p


def absatz(d, text, groesse=11, fett=False, kursiv=False, vor=0, nach=6,
           farbe=None, ausrichtung=None):
    p = d.add_paragraph()
    r = p.add_run(text)
    r.bold = fett
    r.italic = kursiv
    r.font.size = Pt(groesse)
    if farbe:
        r.font.color.rgb = farbe
    p.paragraph_format.space_before = Pt(vor)
    p.paragraph_format.space_after = Pt(nach)
    if ausrichtung is not None:
        p.alignment = ausrichtung
    return p


def zwischentitel(d, text):
    p = d.add_paragraph()
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(12)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    return p


def linie(d, label, breite=60, groesse=11, nach=10):
    p = d.add_paragraph()
    r = p.add_run(label + " " + "_" * breite)
    r.font.size = Pt(groesse)
    p.paragraph_format.space_after = Pt(nach)
    return p


def kaestchen(d, text, groesse=11):
    p = d.add_paragraph()
    r = p.add_run("☐  " + text)
    r.font.size = Pt(groesse)
    p.paragraph_format.space_after = Pt(6)
    return p


def _rand(zelle, farbe="808080", staerke="6"):
    tcPr = zelle._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for kante in ("top", "left", "bottom", "right"):
        el = OxmlElement("w:" + kante)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), staerke)
        el.set(qn("w:color"), farbe)
        borders.append(el)
    tcPr.append(borders)


def tabelle(d, kopf, zeilen, breiten=None, kopf_fett=True, groesse=10):
    t = d.add_table(rows=0, cols=len(kopf) if kopf else len(zeilen[0]))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    if kopf:
        r = t.add_row()
        for i, c in enumerate(kopf):
            zelle = r.cells[i]
            zelle.text = ""
            p = zelle.paragraphs[0]
            run = p.add_run(c)
            run.bold = kopf_fett
            run.font.size = Pt(groesse)
    for z in zeilen:
        r = t.add_row()
        for i, c in enumerate(z):
            zelle = r.cells[i]
            zelle.text = ""
            p = zelle.paragraphs[0]
            run = p.add_run(c)
            run.font.size = Pt(groesse)
    if breiten:
        for r in t.rows:
            for i, w in enumerate(breiten):
                if i < len(r.cells):
                    r.cells[i].width = Cm(w)
    return t


def kastenblock(d, zeilen, groesse=11):
    """Ein umrandeter Kasten mit mehreren Absaetzen."""
    t = d.add_table(rows=1, cols=1)
    t.style = "Table Grid"
    z = t.rows[0].cells[0]
    z.text = ""
    erste = True
    for text, gr, fett in zeilen:
        p = z.paragraphs[0] if erste else z.add_paragraph()
        erste = False
        r = p.add_run(text)
        r.font.size = Pt(gr)
        r.bold = fett
        p.paragraph_format.space_after = Pt(6)
    return t


def seitenumbruch(d):
    d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
