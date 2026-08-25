import { Fragment } from "react"
import { Link } from "react-router-dom"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

/** Eine Ebene des Pfades. Ohne {@code to} ist sie nicht anklickbar. */
export type Crumb = {
  /** Bereits uebersetzte Beschriftung; diese Huelle uebersetzt nichts. */
  label: string
  /**
   * Der ungekuerzte Text, wenn {@code label} eine Kuerzung ist (KAN-80).
   *
   * <p>Gekuerzt wird ausserhalb, weil die Regel dieselbe ist wie in den
   * Tabellen ({@code lib/text.ts}). Diese Huelle setzt nur die Folge daraus:
   * Sichtbar bleibt die Kuerzung, vorgelesen wird der volle Text
   * ({@code aria-label}), und der Mauszeiger zeigt ihn ebenfalls
   * ({@code title}). Ohne das waere „Nachhaltige Mobilit…" fuer einen
   * Screenreader alles, was von dem Titel uebrig bleibt.
   *
   * <p>Ueber {@code aria-label} und nicht ueber einen zweiten, versteckten
   * Textknoten daneben: Beide Ebenen tragen eine Rolle, an der es wirkt
   * ({@code BreadcrumbLink} ist ein Anker, {@code BreadcrumbPage} ein
   * {@code role="link"}), und ein doppelter Text im DOM waere an jeder
   * Fundstelle zweimal zu finden.
   */
  fullLabel?: string
  to?: string
}

/**
 * Das Brotkrumenband unter der Kopfleiste, gleich auf allen Seiten.
 *
 * <p><strong>Ein Band ueber die volle Breite, kein Kaestchen im Inhalt.</strong>
 * Der Pfad sagt, wo man ist, und gehoert damit zur Kopfleiste und nicht zum
 * Seiteninhalt. Deshalb liegt er ausserhalb des Seitencontainers und schliesst
 * nach unten mit einer Trennlinie ab; ein Rahmen um den Pfad selbst entfaellt,
 * die Linie leistet dasselbe ruhiger. Innen laeuft er auf derselben Achse wie
 * Kopfleiste, Karten und Fusszeile.
 *
 * <p><strong>Keine eigene Flaeche.</strong> Das Band nimmt den Grund der
 * Seite an, statt sich mit der Farbe der Karten davon abzuheben: es ist
 * Orientierung und kein Inhalt. Getrennt wird allein durch die Linie.
 *
 * <p><strong>Die leichteste Textrolle, die Foundation fuehrt</strong>
 * ({@code type-label-xs}, 11px). Der Pfad steht auf jeder Seite und wird
 * selten gelesen; in Fliesstextgroesse zoege er Aufmerksamkeit auf sich, die
 * der Ueberschrift darunter gehoert.
 *
 * <p><strong>Der Aufruf gehoert vor den Seitencontainer</strong>, als erstes
 * Kind eines Fragments, nicht in die Spalte mit dem Inhalt: sonst bekaeme das
 * Band die Polsterung der Seite und liefe nicht mehr bis an den Rand.
 *
 * <p>Der Pfad selbst wird nicht hier gebaut, sondern aus der Route abgeleitet
 * ({@code routes/breadcrumbs.ts}, KAN-80) und im Anwendungsrahmen gezeichnet.
 * Diese Huelle bleibt reine Darstellung und uebersetzt nichts.
 *
 * <p>Die letzte Ebene ist die aktuelle Seite und wird nie verlinkt. Der Weg
 * zurueck steht in primary, die aktuelle Ebene in muted-foreground; die
 * Registry haelt es genau umgekehrt (Befund aus KAN-8).
 *
 * <p>Das Element bringt seine eigene Navigations-Landmarke mit (die
 * Primitive setzt {@code aria-label}), es braucht also keine weitere
 * Ueberschrift darueber.
 */
export function BreadcrumbBar({ items }: { items: readonly Crumb[] }) {
  return (
    <div className="border-b">
      <div className="mx-auto w-full max-w-6xl px-4 py-3.5">
        <Breadcrumb>
          <BreadcrumbList className="type-label-xs">
            {items.map((crumb, index) => {
              const last = index === items.length - 1
              return (
                /* Der Trenner steht neben dem Eintrag, nicht darin: beide
                   sind ein li, und ein li im li waere ungueltig. */
                <Fragment key={crumb.to ?? crumb.label}>
                  <BreadcrumbItem>
                    {last || crumb.to === undefined ? (
                      <BreadcrumbPage
                        aria-label={crumb.fullLabel}
                        title={crumb.fullLabel}
                        className="text-muted-foreground"
                      >
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        render={<Link to={crumb.to} />}
                        aria-label={crumb.fullLabel}
                        title={crumb.fullLabel}
                        className="text-primary hover:text-primary-hover"
                      >
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!last && <BreadcrumbSeparator />}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  )
}
