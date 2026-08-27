import type { PointerEvent } from "react"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"
import type { BreadcrumbOriginState } from "@/routes/useBreadcrumb"

/**
 * Die Klemmung selbst: ein Blockelement mit einem Deckel von zwanzig Zeichen
 * und Tailwinds {@code truncate} ({@code overflow-hidden},
 * {@code text-ellipsis}, {@code whitespace-nowrap}).
 *
 * <p><strong>{@code w-fit} gehoert dazu.</strong> Ein Blockelement waere sonst
 * so breit wie seine Zelle, bei kurzen Eintraegen also breiter als ihr Text.
 * Sichtbar faellt das erst auf, wenn das Element etwas kann: Der Anker in
 * {@link TruncatedLink} naehme dann Klicks bis zum Deckel entgegen, auch
 * neben einem kurzen Namen, und der Fokusrahmen zeichnete um leeren Platz.
 * Mit {@code width: fit-content} ist die Flaeche genau der Text, hoechstens
 * aber zwanzig Zeichen breit. Fuer die Tabellenspalte aendert das nichts: Ihr
 * Deckel ist in beiden Faellen das {@code max-width}.
 *
 * <p>Als Konstante und nicht an vier Stellen ausgeschrieben, damit die Zwanzig
 * genau einmal im Code steht. Die Begruendung fuer die uebrigen Angaben steht
 * am Javadoc von {@link TruncatedText}.
 */
const CLAMPED = "block w-fit max-w-[20ch] truncate"

/**
 * Setzt beim Hinzeigen den vollen Text als Mauszeigertext, aber nur, wenn er
 * tatsaechlich abgeschnitten ist.
 *
 * <p><strong>Gemessen und nicht geraten.</strong> Ob ein Eintrag geklemmt ist,
 * weiss allein das Layout: Es haengt an der Schrift, an der Fensterbreite und
 * am Wort selbst. Verglichen wird deshalb am Element ({@code scrollWidth}
 * groesser als {@code clientWidth}) und nicht an der Zeichenzahl. Die
 * Zeichenzahl ist genau die Groesse, die hier nicht mehr entscheidet, und sie
 * stuende dann ein zweites Mal im Code.
 *
 * <p><strong>Beim Zeigen und nicht beim Rendern.</strong> Ein
 * {@code ResizeObserver} je Zelle waere die vollstaendigere Antwort, kostete
 * aber bei fuenf Textspalten und fuenfundzwanzig Zeilen gut hundert Beobachter
 * je Seite, nur um ueber einen Tooltip zu entscheiden. Der Zeitpunkt, an dem
 * der Tooltip zaehlt, ist ohnehin der, an dem jemand hinzeigt; bis dahin
 * kostet die Regel nichts. Das Attribut wird direkt am Element gesetzt, weil
 * React es nicht fuehrt: In dieser Datei steht in keinem JSX ein
 * {@code title}.
 *
 * <p>Erreicht wird damit die Maus, nicht die Tastatur und nicht der Finger.
 * Das ist Absicht und keine Luecke: Der volle Text steht im Dokument, wird
 * vorgelesen und laesst sich markieren; der Mauszeigertext ist nur die
 * Bequemlichkeit obendrauf und traegt keine Information allein.
 */
function showFullTextOnHover(event: PointerEvent<HTMLElement>) {
  const element = event.currentTarget
  if (element.scrollWidth > element.clientWidth) {
    element.setAttribute("title", element.textContent ?? "")
  } else {
    element.removeAttribute("title")
  }
}

/**
 * Raeumt den Mauszeigertext wieder weg, sobald der Zeiger die Zelle
 * verlaesst.
 *
 * <p>Ohne dies bliebe das Attribut nach dem ersten Zeigen dauerhaft stehen,
 * und React fuehrt es nicht: Aendert sich der Text der Zelle spaeter, ohne
 * dass ihr Knoten neu entsteht (die Listen halten ihre Zeilen ueber
 * {@code key}, und eine Abfrage laedt beim Fensterwechsel von selbst nach),
 * taeuscht der Tooltip einen Wert vor, der dort nicht mehr steht. Beim
 * Verlassen zu raeumen schliesst das Fenster auf die Dauer eines einzelnen
 * Zeigens und laesst die Messung dort, wo sie hingehoert: beim Betreten
 * (Befund des frontend-reviewers).
 *
 * <p>Ein Effekt auf den Text waere der vollstaendigere Weg, ginge hier aber
 * nicht ohne Umbau: {@link TruncatedText} kehrt bei leerem Text vor jedem
 * Hook zurueck, ein {@code useEffect} danach waere ein bedingter
 * Hook-Aufruf.
 */
function hideFullTextOnLeave(event: PointerEvent<HTMLElement>) {
  event.currentTarget.removeAttribute("title")
}

/**
 * Ein Tabelleneintrag, sichtbar auf die Breite von zwanzig Zeichen geklemmt,
 * ohne dass der Text dabei verloren geht (KAN-83).
 *
 * <p><strong>Warum ueberhaupt geklemmt wird.</strong> Es ist eine Entscheidung
 * des Nutzers: Die Listen sollen ein ruhiges, gleichmaessiges Raster ergeben,
 * in dem jede Zeile gleich hoch ist und jede Spalte in jeder Zeile gleich
 * breit beginnt. Ohne Deckel zieht ein ausgeschriebener Projekttitel seine
 * Spalte auf, und acht solche Spalten ergeben zusammen mehr Breite, als die
 * Administrationsseite hat. Ein Umbruch statt der Klemmung loest das nicht: Er
 * macht die Zeilen verschieden hoch, je nachdem, wie lang der laengste Eintrag
 * der Zeile gerade ist.
 *
 * <p><strong>Warum in der Darstellung geklemmt und nicht mehr hart
 * geschnitten.</strong> Die erste Fassung schnitt den Text nach dem
 * zwanzigsten Zeichen ab und reichte den vollen daneben nach, im {@code title}
 * und in einem {@code sr-only}-Zwilling. Daran hat der frontend-reviewer zwei
 * Befunde gemeldet, beide bestaetigt:
 *
 * <ul>
 * <li><strong>SC 2.5.3 „Label in Name" (Stufe A) war verletzt.</strong>
 * Sichtbar stand „Nachhaltige Mobilita…", der zugaengliche Name trug den
 * vollen Titel. Sichtbares Label und Name waren damit verschiedene
 * Zeichenketten: Das Auslassungszeichen fehlte im Namen, und der
 * abgeschnittene Wortrest war im Namen keine Folge, die eine Spracheingabe
 * ansagen koennte.</li>
 * <li><strong>Der Text war wirklich weg</strong> und nicht nur optisch
 * beschnitten. Er fehlte beim Markieren und Kopieren, die Browsersuche fand
 * nur die Kurzform, und auf einem Telefon gibt es kein {@code title}. Zwei
 * verschiedene lange Werte wurden dadurch sichtbar ununterscheidbar, etwa die
 * Anmelde- und die HSB-Adresse derselben Person.</li>
 * </ul>
 *
 * <p>Geklemmt wird deshalb erst in der Darstellung: Der volle Text bleibt im
 * Dokument, sichtbarer Text und vorgelesener Name sind wieder dieselbe
 * Zeichenkette, und markieren, kopieren und finden gehen wieder. In Kauf
 * genommen ist dafuer, dass die Schrift nicht dicktengleich ist: Je nach Wort
 * stehen etwa zwanzig bis sechsundzwanzig Buchstaben da statt genau zwanzig.
 * Fuer ein ruhiges Raster zaehlt die Breite und nicht die Zahl der Buchstaben.
 *
 * <p><strong>Der Deckel sitzt am Inhalt der Zelle, nicht an der
 * Tabelle.</strong> Ein {@code max-width} an der Zelle waere wirkungslos: Bei
 * {@code table-layout: auto} ist seine Wirkung auf ein {@code td} nach CSS 2.1
 * §17.5.2 undefiniert, und die Engines ignorieren es. Genau daran ist die
 * erste Fassung dieses Punktes gescheitert. Die naheliegende Antwort
 * {@code table-layout: fixed} verlangte, dass <em>jede</em> Spalte
 * <em>jeder</em> Tabelle eine ausdrueckliche Breite bekommt, sonst teilen sich
 * die uebrigen den Rest zu gleichen Teilen: acht Tabellen mit je sechs bis
 * acht neuen Breitenangaben, die alle zur Zeichenzahl passen muessten. Ein
 * Blockelement <em>in</em> der Zelle braucht davon nichts. Dort wirkt
 * {@code max-width} ganz normal, und weil der Inhalt gedeckelt ist, kann die
 * Spalte nicht breiter werden als er. Die Tabellen bleiben unangetastet, und
 * die Regel steht weiter an genau einer Stelle.
 *
 * <p><strong>Warum {@code ch} und nicht Pixel.</strong> Ein {@code ch} ist die
 * Breite der Ziffer Null in der laufenden Schrift, also ein Mass in Zeichen
 * und nicht in Pixeln. Damit steht die Zwanzig weiter genau einmal da, nur
 * eben als Breite, und sie waechst mit, wenn jemand die Schriftgroesse
 * hochsetzt (SC 1.4.4). Ein Pixelmass waere eine zweite Zahl, die zur
 * Zeichenzahl passen muesste, und bei vergroesserter Schrift waere sie wieder
 * falsch.
 *
 * <p><strong>Der Mauszeigertext erscheint nur, wo wirklich etwas
 * fehlt.</strong> Ob geklemmt wird, entscheidet jetzt die Darstellung und
 * nicht mehr die Zeichenzahl. Ein fest gesetztes {@code title} waere deshalb
 * ein Tooltip auch an jedem Eintrag, an dem nichts fehlt, und zugleich eine
 * zweite Ansage desselben Textes, denn neben einem vorhandenen Namen wird
 * {@code title} zur Beschreibung. Gemessen wird darum erst beim Hinzeigen; die
 * Einzelheiten stehen an {@link showFullTextOnHover}.
 *
 * <p><strong>Wo die Regel nicht gilt.</strong> Sie gilt fuer Datensaetze in
 * Listen, nicht fuer Fliesstext und nicht fuer reine Vorlesetabellen:
 *
 * <ul>
 * <li>Die Tabelle <em>im Beitrag</em> eines Projekts
 * ({@code project-content/renderer/renderBlockNode.tsx}) bleibt unangetastet.
 * Dort steht der Text der Autor:in, kein Datensatz einer Liste; eine Klemmung
 * verstuemmelte den Beitrag.</li>
 * <li>Die {@code sr-only}-Datentabellen der Diagramme
 * ({@code administration/components/UserStatisticsCard.tsx} und
 * {@code FacultyDistributionCard.tsx}) bleiben unangetastet. Sie sind allein
 * fuer Hilfsmittel da; eine Klemmung machte dort nichts schmaler, weil dort
 * nichts sichtbar ist.</li>
 * <li>Zellen, die eine Marke statt eines Textes tragen (StatusBadge,
 * RoleBadge, UserStatusBadge, Pill, Auswahlkaestchen, Schalter,
 * Aktionsknoepfe), bleiben ebenfalls unangetastet. Ihre Beschriftungen kommen
 * aus einer festen Auswahl von i18n-Werten und wachsen nicht mit den Daten:
 * die laengste ist mit 23 Zeichen „Password change pending"
 * ({@code user.passwordChangeRequired}), alle uebrigen liegen bei hoechstens
 * zwanzig. Eine feste Beschriftung zieht keine Spalte auf, und geklemmt waere
 * sie nur schwerer zu lesen.</li>
 * </ul>
 *
 * <p>Der Brotkrumenpfad ({@code BreadcrumbBar}) ist mit demselben Ticket
 * mitgezogen und benutzt diese Komponente. Er hatte denselben Mangel aus
 * demselben Grund: Seine Stationen sind Links, sichtbar stand dort der
 * gekappte Titel und im Namen der volle.
 *
 * @param text Der volle Eintrag. {@code null}, {@code undefined} und der
 *             leere Text ergeben nichts, damit die nullable Felder des
 *             Contracts (§3.3) ohne Fallunterscheidung durchlaufen.
 */
export function TruncatedText({ text }: { text?: string | null }) {
  if (text === null || text === undefined || text.trim() === "") {
    return null
  }

  return (
    <span
      className={CLAMPED}
      onPointerEnter={showFullTextOnHover}
      onPointerLeave={hideFullTextOnLeave}
    >
      {text}
    </span>
  )
}

/**
 * Derselbe Eintrag, wenn er ein Link ist: der Projekttitel, der Name der
 * Autor:in, der Name in der Nutzerverwaltung, eine Station des
 * Brotkrumenpfads.
 *
 * <p><strong>Kein {@code aria-label} mehr.</strong> Der volle Text ist jetzt
 * der Linktext selbst. Ein Name daneben waere bestenfalls dieselbe
 * Zeichenkette doppelt und schlimmstenfalls wieder eine andere als die
 * sichtbare, und genau das war der Befund zu SC 2.5.3. Aus demselben Grund
 * gibt es auch keinen {@code sr-only}-Zwilling im Anker: Er stuende zweimal im
 * Linkverzeichnis.
 *
 * <p><strong>Die Klemmklassen liegen am Anker selbst</strong> und nicht an
 * einer Huelle darum. Eine Huelle mit {@code overflow: hidden} beschnitte auch
 * den Fokusrahmen des Ankers darin, und zwar genau an der Klemmkante; am Anker
 * selbst umschliesst er die Flaeche, die es wirklich gibt (SC 2.4.11).
 * Zusammen mit {@code w-fit} ist das genau der sichtbare Text.
 */
export function TruncatedLink({
  text,
  to,
  state,
  className,
}: {
  text: string
  to: string
  /** Herkunft fuer den Brotkrumenpfad der Zielseite (KAN-80). */
  state?: BreadcrumbOriginState
  className?: string
}) {
  return (
    <Link
      to={to}
      state={state}
      className={cn(CLAMPED, className)}
      onPointerEnter={showFullTextOnHover}
      onPointerLeave={hideFullTextOnLeave}
    >
      {text}
    </Link>
  )
}
