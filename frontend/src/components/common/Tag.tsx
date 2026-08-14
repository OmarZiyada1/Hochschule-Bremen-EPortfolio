import type { ReactNode } from "react"

import { Pill } from "@/components/common/Pill"

/**
 * Badge fuer Kategorie, Modul, Studiengang und Fakultaet. Bewusst
 * einfarbig ueber --badge-neutral-*: Fakultaeten werden nicht farblich
 * codiert, unterschieden wird allein ueber die Beschriftung (Confluence
 * "Designentscheidungen", Abschnitt 2.4). Es gibt deshalb auch keine
 * Stelle, die facultyId auf eine Farbe abbildet.
 *
 * Fachlich ist das die neutrale Pille, und genau die ist Pill mit seinem
 * Standardton. Deshalb steht hier keine zweite Klassenliste: das neutrale
 * Badge hat eine Adresse, und Tag ist der sprechende Name dafuer an
 * Taxonomien. Wer die Toenung frei waehlen will, nimmt Pill direkt.
 */
export function Tag({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <Pill tone="neutral" className={className}>
      {children}
    </Pill>
  )
}
