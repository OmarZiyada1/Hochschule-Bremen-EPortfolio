import type { ReactNode } from "react"

import type {
  GalleryColumns,
  ImageWidth,
} from "@/features/project-content/blockTypes"

/**
 * Die gemeinsame Huelle der Medienblocke: ein {@code figure} mit optionaler
 * {@code figcaption}.
 *
 * <p><strong>Breite und Spaltenzahl stehen als Datenattribut</strong>, nie
 * als Inline-Stil. Ein Inline-Stil bliebe auf dem Telefon bei 50 Prozent
 * und liesse sich per Medienabfrage nicht ueberschreiben; die Regeln in
 * {@code styles/project-content.css} brechen unterhalb der schmalen Ansicht
 * auf volle Breite um, und KAN-41 braucht fuer den Druck andere Breiten.
 *
 * <p>Die {@code figcaption} bekommt eine Kennung, damit das Medium darin
 * auf sie zeigen kann: sie ist sein Name, sobald sie gefuellt ist.
 *
 * <p><strong>Zu {@code role="group"} an der Galerie.</strong> Ein
 * {@code figure} bringt seine Rolle schon mit, und fuer sie legt HTML-AAM
 * fest, dass die {@code figcaption} den zugaenglichen Namen liefert. Wird
 * die Rolle auf {@code group} ueberschrieben, gilt "Name nur vom Autor",
 * und der Name faellt weg. Deshalb setzt diese Huelle in dem Fall
 * ausdruecklich {@code aria-labelledby} auf die Unterschrift; ohne
 * Unterschrift gibt es keinen Namen, und dann ist auch die Gruppierung
 * keine Verschlechterung (Befund aus dem Frontend-Review zu KAN-10).
 */
export function MediaFigure({
  children,
  caption,
  captionId,
  width,
  columns,
  role,
}: {
  children: ReactNode
  caption?: string
  captionId?: string
  width?: ImageWidth
  columns?: GalleryColumns
  role?: "group"
}) {
  const hasCaption = caption !== undefined && caption.trim().length > 0
  return (
    <figure
      role={role}
      aria-labelledby={role !== undefined && hasCaption ? captionId : undefined}
      data-width={width}
      data-columns={columns}
    >
      {children}
      {hasCaption ? <figcaption id={captionId}>{caption}</figcaption> : null}
    </figure>
  )
}
