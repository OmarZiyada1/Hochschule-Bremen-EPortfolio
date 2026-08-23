import type { LucideIcon } from "lucide-react"

/**
 * Die benannte Karte fuer die Blocktypen, die auf der Schreibflaeche nicht
 * so erscheinen wie danach: Ton, Dokument und Einbettung.
 *
 * <p>Der Videoblock stand hier auch, zeigt seit der Inline-Bedienung aus
 * KAN-36 aber den echten Player; die Abwaegung dazu steht an
 * {@code VideoNodeView}. Fuer die uebrigen drei bleibt die Karte: sie sagt,
 * was an dieser Stelle steht; wie es aussieht, zeigt die Vorschau, und die
 * benutzt denselben Renderer wie die oeffentliche Seite.
 */
export function MediaCard({
  icon: Icon,
  title,
  detail,
  caption,
}: {
  icon: LucideIcon
  title: string
  detail: string
  caption?: string | null
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-muted/40 px-4 py-3">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-col">
        <span className="type-body-sm font-semibold">{title}</span>
        <span className="type-caption truncate text-muted-foreground">
          {detail}
        </span>
        {caption != null && caption !== "" && (
          <span className="type-caption truncate text-muted-foreground italic">
            {caption}
          </span>
        )}
      </span>
    </div>
  )
}
