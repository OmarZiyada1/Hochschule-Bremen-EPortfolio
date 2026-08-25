import type { MouseEvent, ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"

import type { ProjectReference, ProjectStatus } from "@/api/types"
import { StatusBadge } from "@/components/common/StatusBadge"
import { TableCell, TableRow } from "@/components/ui/table"
import { fullNameOf, type PersonName } from "@/lib/name"
import { isTruncated, truncate } from "@/lib/text"
import { useBreadcrumbOrigin } from "@/routes/useBreadcrumb"

/**
 * Projektzeile der Tabellenansichten (Figma "Table Data Row"): Meine
 * Reviews, Projekte der Administrationsseite und das Top-10-Protokoll.
 *
 * Die Spalte „Fach" kam mit KAN-37 dazu, zusammen mit dem Feld module an
 * der Kachel (Contract v68, §3.9): „Meine Reviews" zeigt sie nach Template,
 * und ohne das Feld waere sie nicht fuellbar gewesen. Sie ist optional wie
 * die uebrigen; wer sie nicht setzt, bekommt eine leere Zelle und keine
 * verschobene Tabelle.
 *
 * Die Spalten entsprechen ProjectCardResponse (§6.1); die Kopfzeile bleibt
 * die Primitive, weil ihre Beschriftungen zur Seite gehoeren und nicht zur
 * Zeile. Eine Huelle um TableHead traege kein Domaenenwissen und waere nur
 * eine zweite Stelle zum Pflegen, aus demselben Grund, aus dem der
 * Breadcrumb keine bekommt.
 *
 * actions ist ein Platz und keine fertige Aktion: welche Handlungen an
 * einer Zeile haengen, entscheidet die Rechtematrix je Seite (§5). Die
 * Zeile weiss davon nichts.
 *
 * <p>{@code selection} ist derselbe Gedanke am anderen Ende (KAN-38): die
 * Projektverwaltung waehlt mehrere Zeilen aus und wechselt ihren Status in
 * einem Aufruf, „Meine Reviews" tut das nicht. Die Zelle entsteht deshalb nur,
 * wenn der Aufrufer etwas hineingibt; ohne sie hat die Zeile genau so viele
 * Spalten wie zuvor. Ein Kaestchen fest einzubauen und es andernorts
 * auszublenden haette die Kopfzeile beider Seiten auseinandergebracht.
 *
 * <p><strong>Die ganze Zeile ist anklickbar</strong> (KAN-80), nicht nur der
 * Titel. Anders als bei der Kachel geht das hier nicht ueber eine
 * ausgelegte Linkflaeche: Sie braeuchte ein positioniertes Elternteil, und
 * ein {@code position: relative} an einem {@code tr} ist der eine Ort, an dem
 * sich die Browser bis heute uneins sind. Die Zeile navigiert deshalb im
 * Klick, und der Titel bleibt der echte Link fuer Tastatur, Mittelklick und
 * „in neuem Tab oeffnen".
 *
 * <p><strong>Der Titel wird auf {@link truncate} Zeichen gekuerzt</strong>
 * (KAN-80). Sieben Spalten und ein ausgeschriebener Projekttitel ergaben eine
 * Tabelle, die breiter war als das Fenster; sichtbar bleibt der Anfang,
 * vorgelesen und im {@code title} steht der ganze Titel.
 */
export function ProjectTableRow({
  title,
  author,
  studyProgram,
  semester,
  module,
  status,
  href,
  actions,
  selection,
}: {
  title: string
  /**
   * Autor:in der Zeile. Mit {@code id} wird der Name zum Link auf ihr
   * Portfolio (KAN-80); ohne bleibt es beim blossen Text, etwa in der
   * Komponentenschau, die keine echte Person zeigt.
   */
  author?: (PersonName & { id?: string }) | null
  studyProgram?: ProjectReference | null
  semester?: string | null
  module?: ProjectReference | null
  status?: ProjectStatus
  href?: string
  actions?: ReactNode
  /**
   * Auswahlkaestchen als erste Zelle, fuer Ansichten mit Mehrfachauswahl.
   * Der Zustand liegt beim Aufrufer: welche Zeilen ausgewaehlt sind, weiss
   * die Tabelle und nicht die Zeile.
   */
  selection?: ReactNode
}) {
  const navigate = useNavigate()
  const origin = useBreadcrumbOrigin()

  /**
   * Ein Klick irgendwo in der Zeile oeffnet das Projekt.
   *
   * <p>Drei Faelle bleiben ausgenommen, sonst fraesse die Zeile die Bedienung
   * ihrer eigenen Zellen: ein Klick auf etwas, das selbst ein Ziel hat
   * (Link, Schaltflaeche, Auswahlkaestchen, Menuepunkt), und ein Klick, der
   * eine Textmarkierung abschliesst. Wer in einer Zeile etwas markiert, will
   * kopieren und nicht navigieren.
   */
  function openRow(event: MouseEvent<HTMLTableRowElement>) {
    if (href === undefined) {
      return
    }
    if (
      event.target instanceof Element &&
      event.target.closest("a, button, input, label, [role='menuitem']") !==
        null
    ) {
      return
    }
    if ((window.getSelection()?.toString().length ?? 0) > 0) {
      return
    }
    void navigate(href, { state: origin })
  }

  const shortTitle = truncate(title)

  return (
    <TableRow
      onClick={openRow}
      className={href === undefined ? undefined : "cursor-pointer"}
    >
      {selection !== undefined && (
        <TableCell className="w-0">{selection}</TableCell>
      )}
      <TableCell className="font-semibold">
        {/*
         * Router-Link statt rohem Anker: ein roher href laedt die ganze
         * Anwendung neu und wirft Query-Cache und Scrollposition weg
         * (Befund aus KAN-80, dieselbe Begruendung wie an der Kachel).
         */}
        {href ? (
          <Link
            to={href}
            state={origin}
            /* Der volle Titel bleibt der zugaengliche Name und der
               Mauszeigertext; sichtbar steht die Kuerzung. Ein zweiter,
               versteckter Textknoten daneben waere derselbe Titel zweimal im
               DOM. */
            aria-label={isTruncated(title) ? title : undefined}
            title={isTruncated(title) ? title : undefined}
            className="hover:underline focus-visible:underline"
          >
            {shortTitle}
          </Link>
        ) : (
          <span title={isTruncated(title) ? title : undefined}>
            {shortTitle}
          </span>
        )}
      </TableCell>
      <TableCell>
        {author &&
          (author.id === undefined ? (
            fullNameOf(author)
          ) : (
            <Link
              to={`/portfolios/${author.id}`}
              state={origin}
              className="hover:underline focus-visible:underline"
            >
              {fullNameOf(author)}
            </Link>
          ))}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {studyProgram?.name}
      </TableCell>
      <TableCell className="text-muted-foreground">{semester}</TableCell>
      <TableCell className="text-muted-foreground">{module?.name}</TableCell>
      <TableCell>{status && <StatusBadge status={status} />}</TableCell>
      <TableCell className="text-right">{actions}</TableCell>
    </TableRow>
  )
}
