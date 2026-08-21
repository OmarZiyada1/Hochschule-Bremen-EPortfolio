import type { LucideIcon } from "lucide-react"

/**
 * Die benannte Karte fuer die Blocktypen, die auf der Schreibflaeche nicht
 * so erscheinen wie danach: Video, Ton, Dokument und Einbettung.
 *
 * <p><strong>Warum kein echter Player und kein iframe beim Schreiben.</strong>
 * Beide fangen Tastatur und Zeiger ab. Der Cursor kaeme an ihnen nicht mehr
 * vorbei, ein fremder Rahmen nimmt den Fokus und gibt ihn nicht zurueck,
 * und ein Video startete mitten im Schreiben. Die Karte sagt stattdessen,
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
