import type { MouseEvent, ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import type { ProjectReference, ProjectStatus } from "@/api/types"
import { StatusBadge } from "@/components/common/StatusBadge"
import { TruncatedLink, TruncatedText } from "@/components/common/TruncatedText"
import { TableCell, TableRow } from "@/components/ui/table"
import { fullNameOf, type PersonName } from "@/lib/name"
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
 * <p><strong>Jede Textspalte ist auf zwanzig Zeichen Breite geklemmt</strong>
 * (KAN-83): Titel, Autor:in, Studiengang, Semester und Fach laufen ueber
 * {@link TruncatedText} bzw. {@link TruncatedLink}, die Begruendung und die
 * Ausnahmen stehen dort. Deshalb tragen diese Zellen selbst keine
 * Hoechstbreite und kein {@code whitespace-normal} mehr: Ein
 * {@code max-width} an einer Zelle ist ohne {@code table-layout: fixed}
 * wirkungslos, der Deckel sitzt darum am Inhalt der Zelle und nicht an ihr.
 * Geklemmt und nicht geschnitten: Der volle Text bleibt im Dokument,
 * markierbar, kopierbar und fuer die Browsersuche auffindbar.
 *
 * <p>Status und Aktionen bleiben unangetastet: Dort steht kein Datensatz,
 * sondern eine Marke aus fester Auswahl bzw. ein Menue.
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
         * TruncatedLink statt Link: Router-Link statt rohem Anker, weil ein
         * roher href die ganze Anwendung neu laedt und Query-Cache samt
         * Scrollposition wegwirft (Befund aus KAN-80, dieselbe Begruendung
         * wie an der Kachel), und geklemmt, weil der Titel der laengste
         * Eintrag der Zeile ist.
         */}
        {href ? (
          <TruncatedLink
            text={title}
            to={href}
            state={origin}
            className="hover:underline focus-visible:underline"
          />
        ) : (
          <TruncatedText text={title} />
        )}
      </TableCell>
      <TableCell>
        {author &&
          (author.id === undefined ? (
            <TruncatedText text={fullNameOf(author)} />
          ) : (
            <TruncatedLink
              text={fullNameOf(author)}
              to={`/portfolios/${author.id}`}
              state={origin}
              className="hover:underline focus-visible:underline"
            />
          ))}
      </TableCell>
      <TableCell className="text-muted-foreground">
        <TruncatedText text={studyProgram?.name} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        <TruncatedText text={semester} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        <TruncatedText text={module?.name} />
      </TableCell>
      <TableCell>{status && <StatusBadge status={status} />}</TableCell>
      <TableCell className="text-right">{actions}</TableCell>
    </TableRow>
  )
}
