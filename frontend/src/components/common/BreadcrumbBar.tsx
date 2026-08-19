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
                      <BreadcrumbPage className="text-muted-foreground">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        render={<Link to={crumb.to} />}
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
