# -*- coding: utf-8 -*-
"""Bausteine fuer Confluence-Storage-Format."""

def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

def p(*parts):
    return "<p>" + "".join(parts) + "</p>"

def h1(t):
    return "<h1>" + t + "</h1>"

def h2(t):
    return "<h2>" + t + "</h2>"

def h3(t):
    return "<h3>" + t + "</h3>"

def b(t):
    return "<strong>" + t + "</strong>"

def i(t):
    return "<em>" + t + "</em>"

def code(t):
    return "<code>" + t + "</code>"

def panel(kind, *parts):
    """kind: info, note, warning, tip"""
    return ('<ac:structured-macro ac:name="%s" ac:schema-version="1">'
            "<ac:rich-text-body>%s</ac:rich-text-body>"
            "</ac:structured-macro>") % (kind, "".join(parts))

def ul(items):
    return "<ul>" + "".join("<li><p>%s</p></li>" % x for x in items) + "</ul>"

def ol(items):
    return "<ol>" + "".join("<li><p>%s</p></li>" % x for x in items) + "</ol>"

_TASK_N = [0]

def tasks(items):
    out = ['<ac:task-list>']
    for it in items:
        _TASK_N[0] += 1
        out.append(
            "<ac:task><ac:task-id>%d</ac:task-id>"
            "<ac:task-status>incomplete</ac:task-status>"
            "<ac:task-body><span>%s</span></ac:task-body></ac:task>" % (_TASK_N[0], it)
        )
    out.append("</ac:task-list>")
    return "".join(out)

def table(head, rows, layout="default"):
    out = ['<table data-layout="%s"><tbody>' % layout]
    if head:
        out.append("<tr>" + "".join("<th><p>%s</p></th>" % c for c in head) + "</tr>")
    for r in rows:
        cells = []
        for c in r:
            cells.append("<td><p>%s</p></td>" % c if c else "<td><p /></td>")
        out.append("<tr>" + "".join(cells) + "</tr>")
    out.append("</tbody></table>")
    return "".join(out)

def kv(rows, layout="default"):
    """Zweispaltige Tabelle mit Kopfspalte links."""
    out = ['<table data-layout="%s"><tbody>' % layout]
    for k, v in rows:
        out.append("<tr><th><p>%s</p></th>%s</tr>"
                   % (k, "<td><p>%s</p></td>" % v if v else "<td><p /></td>"))
    out.append("</tbody></table>")
    return "".join(out)

def link(page_title, text=None):
    t = text or page_title
    return ('<ac:link><ri:page ri:content-title="%s" /># '
            '<ac:plain-text-link-body><![CDATA[%s]]></ac:plain-text-link-body>'
            "</ac:link>") % (page_title, t)

def pagelink(page_title, text=None):
    if text:
        return ('<ac:link><ri:page ri:content-title="%s" />'
                '<ac:link-body>%s</ac:link-body></ac:link>' % (page_title, text))
    return '<ac:link><ri:page ri:content-title="%s" /></ac:link>' % page_title

def excerpt(body, name=None):
    """Auszug-Bereich, der anderswo eingebunden werden kann."""
    return ('<ac:structured-macro ac:name="excerpt" ac:schema-version="1">'
            '<ac:parameter ac:name="hidden">false</ac:parameter>'
            '<ac:parameter ac:name="atlassian-macro-output-type">BLOCK</ac:parameter>'
            "<ac:rich-text-body>%s</ac:rich-text-body>"
            "</ac:structured-macro>") % body

def excerpt_include(page_title):
    return ('<ac:structured-macro ac:name="excerpt-include" ac:schema-version="1">'
            '<ac:parameter ac:name="">'
            '<ac:link><ri:page ri:content-title="%s" /></ac:link>'
            "</ac:parameter>"
            '<ac:parameter ac:name="nopanel">true</ac:parameter>'
            "</ac:structured-macro>") % page_title

def children_macro():
    return ('<ac:structured-macro ac:name="children" ac:schema-version="2">'
            '<ac:parameter ac:name="all">false</ac:parameter>'
            "</ac:structured-macro>")

def kopf(wer, wann):
    return panel("info",
                 p(b("Wer diese Seite in der Hand hat: ") + wer),
                 p(b("Wann sie gebraucht wird: ") + wann))
