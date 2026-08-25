import type { ReactNode } from "react"

/**
 * Eine Zeile einer Beschreibungsliste: Beschriftung ueber dem Wert
 * (KAN-39).
 *
 * <p>Sie steht in einer eigenen Datei, weil zwei Dialoge dieselbe Form
 * brauchen: die Zusammenfassung nach dem Anlegen eines Kontos und die
 * Detailansicht dazu. Zwei fast gleiche {@code dt}/{@code dd}-Paare mit
 * derselben Beschriftungsklasse waeren genau die Dopplung, die der Befund
 * aus KAN-7 meint (Befund des frontend-reviewers zu KAN-39).
 *
 * <p>Entweder ein Text oder ein Knoten, etwa ein Badge; beides zugleich
 * ergaebe zwei Werte zu einer Beschriftung.
 */
export function DetailRow({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="type-label-xs text-muted-foreground uppercase">{label}</dt>
      <dd className="break-words">{children ?? value}</dd>
    </div>
  )
}
