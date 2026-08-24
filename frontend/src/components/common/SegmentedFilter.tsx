import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/**
 * Segmentschalter fuer einen Filter mit wenigen, sich ausschliessenden
 * Werten. Die sichtbare Gestalt der Statusleisten des Projekts.
 *
 * <p><strong>Warum es diesen Baustein gibt.</strong> Bis zur Nacharbeit an
 * KAN-37 stand die Gestalt allein im {@code ProjectStatusFilter} und war an
 * {@code ProjectStatus} gebunden. Der Nominierungsbereich braucht dieselbe
 * Leiste ueber {@code NominationStatus}; eine zweite Abschrift daneben liefe
 * beim naechsten Feinschliff auseinander, und genau das meint der Befund aus
 * KAN-7. Der Statusfilter komponiert diesen Baustein jetzt, statt ihn zu
 * wiederholen.
 *
 * <p><strong>Komponiert die Registry-Primitive toggle-group</strong>, statt
 * einen Schalter nachzubauen: Tastaturbedienung, Fokusfuehrung und die
 * Zustandsmeldung ueber {@code aria-pressed} bringt Base UI mit, und genau
 * die gehen bei einem Eigenbau zuverlaessig verloren (Skill frontend-shadcn,
 * Abschnitt 1). Von Hand kommt nur das Domaenenwissen dazu: welche Werte es
 * gibt und wie sie heissen.
 *
 * <p><strong>Zu den beiden Radien.</strong> Aussen {@code rounded-card}
 * (12px), innen {@code rounded-control} (8px), dazwischen die 4px aus
 * {@code p-1}: 12 minus 4 ergibt 8, die aktive Flaeche sitzt damit
 * konzentrisch in der Leiste und laeuft an keiner Stelle parallel zu einer
 * Kante mit anderem Radius.
 *
 * <p><strong>Warum der Radius am Segment doppelt dasteht.</strong> Ein
 * blankes {@code rounded-control} wirkt hier nicht. {@code ToggleGroupItem}
 * haengt, sobald {@code spacing={0}} gesetzt ist, an jedes Segment
 * {@code group-data-[spacing=0]/toggle-group:rounded-none}, dazu am ersten
 * und letzten {@code first:rounded-l-lg} und {@code last:rounded-r-lg}. Fuer
 * tailwind-merge sind ein modifiziertes und ein unmodifiziertes
 * {@code rounded-*} verschiedene Schluessel: beide Klassen ueberleben, und in
 * der Kaskade gewinnt der zusammengesetzte Selektor. Sichtbar war das an der
 * eckigen aktiven Flaeche, waehrend das erste und das letzte Segment ihre
 * aeusseren Ecken behielten. Derselbe Modifikator loest es auf, und der
 * unmodifizierte Wert bleibt daneben stehen, damit die Leiste auch mit einem
 * anderen {@code spacing} richtig aussieht. Dasselbe Muster wie bei der Hoehe
 * in {@code FilterSelect} und beim Mass in {@code UserAvatar}.
 *
 * <p>{@code px-4} steht aus demselben Grund zweimal da: die Primitive setzt
 * bei {@code spacing={0}} ein {@code px-2} dagegen.
 *
 * <p>Zwei Zwischenstaende waren falsch und stehen hier, damit sie nicht
 * wiederkehren. Beide auf {@code rounded-control} liess die aktive Flaeche
 * mit demselben Radius an eine 4px entfernte Kante stossen. Innen
 * {@code rounded-selection} (4px) war rechnerisch konzentrisch, aber 4px sind
 * auf einer 32px hohen Flaeche so wenig, dass sie als scharfe Ecke gelesen
 * werden. Eine Pille daraus zu machen ist die andere Richtung und ebenfalls
 * falsch: ein Segmentschalter zeigt eine geteilte Flaeche und keine Reihe von
 * Marken.
 *
 * <p><strong>Ruhige Segmente, deutliches aktives.</strong> Die Leiste faerbt
 * ihre Beschriftungen auf {@code muted-foreground}, das aktive Segment holt
 * sich {@code foreground} zurueck. Ohne diesen Unterschied stehen fuenf
 * gleich kraeftige Beschriftungen nebeneinander und die Auswahl haengt allein
 * an der helleren Flaeche. Beide Toene bleiben ueber 4,5:1 gegen ihren
 * Untergrund, in hell wie in dunkel (SC 1.4.3).
 *
 * <p>Die Zustandsfarben stehen mit denselben Modifikatoren wie in der
 * erzeugten Datei ({@code aria-pressed}, {@code data-[state=on]}), damit
 * tailwind-merge sie gegeneinander aufloest und die aktive Flaeche nicht von
 * der Vorgabe der Registry ueberschrieben wird. Der Komponentencode selbst
 * bleibt unangetastet.
 */
export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onValueChange,
  fallback,
  className,
}: {
  /**
   * Zugaenglicher Name der Gruppe. Sichtbar steht ueber dem Schalter
   * bewusst keine Ueberschrift; ohne diesen Namen waere die Gruppe fuer
   * einen Screenreader eine Reihe unbeschrifteter Knoepfe.
   */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /**
   * Wert, auf den die Leiste faellt, wenn Base UI den Druck aufhebt: das
   * geschieht, sobald das aktive Segment erneut betaetigt wird, und die
   * Liste ist dann leer. Ein Filter ohne jeden Wert ist kein Zustand einer
   * Seite dieses Projekts.
   */
  fallback: T
  className?: string
}) {
  return (
    <ToggleGroup
      aria-label={label}
      spacing={0}
      value={[value]}
      onValueChange={(next) =>
        onValueChange((next[0] as T | undefined) ?? fallback)
      }
      className={cn(
        "max-w-full flex-wrap rounded-card border bg-muted p-1 text-muted-foreground",
        className
      )}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="rounded-control px-4 group-data-[spacing=0]/toggle-group:rounded-control group-data-[spacing=0]/toggle-group:px-4 aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm data-[state=on]:bg-card"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
