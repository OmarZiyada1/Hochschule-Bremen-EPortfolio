import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsOf, fullNameOf, type PersonName } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Avatarflaeche einer Person: Bild, sonst Initialen auf der Markenflaeche
 * (Figma "Avatar").
 *
 * Sie buendelt die drei Eingriffe, die sonst an jeder Aufrufstelle erneut
 * stuenden: der Radius auf radius-card statt der Kreisform der Registry
 * (im Ticket auf 12px entschieden, Foundation 7), die Markenflaeche statt
 * muted, und die Initialen aus dem Namen. Alles laeuft ueber className, die
 * erzeugte Datei bleibt unveraendert.
 *
 * Standardmaessig traegt die Flaeche keinen zugaenglichen Namen: sie steht
 * fast immer neben dem ausgeschriebenen Namen, und ein zweiter Name daneben
 * wuerde doppelt vorgelesen. Steht sie einmal allein, setzt der Aufrufer
 * labelled auf true.
 *
 * Mit labelled traegt die Flaeche den Namen als sr-only-Text, und die
 * Initialen werden versteckt. Ein aria-hidden am Wurzelelement zu entfernen
 * genuegt dafuer nicht: ohne Bild besteht der Inhalt nur aus den Initialen,
 * und ein Screenreader sagt dann "MB" statt "Mira Beispiel". Das alt des
 * Bildes hilft ebenfalls nur, wenn ueberhaupt eines da ist, und das ist der
 * Ausnahmefall.
 */
export function UserAvatar({
  person,
  imageUrl,
  size = "sm",
  labelled = false,
  className,
}: {
  person: PersonName
  imageUrl?: string | null
  size?: "sm" | "default" | "lg"
  labelled?: boolean
  className?: string
}) {
  const name = fullNameOf(person)

  return (
    <Avatar
      size={size}
      aria-hidden={labelled ? undefined : true}
      className={cn("rounded-card after:rounded-card", className)}
    >
      {labelled && <span className="sr-only">{name}</span>}
      {imageUrl && (
        <AvatarImage className="rounded-card" src={imageUrl} alt="" />
      )}
      <AvatarFallback
        aria-hidden={labelled ? true : undefined}
        className="rounded-card bg-surface-brand font-bold text-surface-brand-foreground"
      >
        {initialsOf(person)}
      </AvatarFallback>
    </Avatar>
  )
}
