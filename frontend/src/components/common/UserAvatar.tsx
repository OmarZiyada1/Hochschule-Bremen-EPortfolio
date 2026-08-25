import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AVATAR_SIZES, type UserAvatarSize } from "@/lib/avatarSize"
import { initialsOf, fullNameOf, type PersonName } from "@/lib/name"
import { cn } from "@/lib/utils"

/*
 * Die Masstabelle liegt in lib/avatarSize.ts, weil ProjectPeople daraus die
 * Breite einer aufgefaecherten Gruppe rechnet (KAN-80). Der Typ wird hier
 * weiterexportiert, damit die Aufrufstellen ihn wie bisher von der Komponente
 * beziehen.
 *
 * <strong>Warum das Mass an der Huelle steht und nicht am size-Prop der
 * Primitive:</strong> deren Stufen kommen als data-[size=…]:size-… und tragen
 * damit eine hoehere Spezifitaet als eine schlichte size-Klasse von aussen.
 * Ein size-24 an der Aufrufstelle bleibt deshalb wirkungslos, und nichts warnt
 * davor: kein Compilerfehler, keine Lint-Warnung, kein roter Test, der Avatar
 * ist einfach zu klein (Befund aus KAN-34). Die Huelle gibt der Primitive
 * darum immer dieselbe Stufe und setzt das Mass selbst; so loest
 * tailwind-merge size-8 gegen size-N auf.
 *
 * Die Initialen laufen aus demselben Grund ueber text-*, nicht ueber eine
 * type-Rolle: AvatarFallback bringt text-sm mit, und verdraengt wird das
 * nur von einer Klasse aus derselben Gruppe.
 */
export type { UserAvatarSize }

/**
 * Avatarflaeche einer Person: Bild, sonst Initialen auf der Markenflaeche
 * (Figma "Avatar").
 *
 * Sie buendelt die drei Eingriffe, die sonst an jeder Aufrufstelle erneut
 * stuenden: der Radius, die Markenflaeche statt muted, und die Initialen aus
 * dem Namen. Alles laeuft ueber className, die erzeugte Datei bleibt
 * unveraendert.
 *
 * <p><strong>Zum Radius: radius-pill, also die Kreisform.</strong> Bis zur
 * Nacharbeit an KAN-37 stand hier radius-card, entschieden mit KAN-69 nach
 * Foundation 7 und der Figma-Angabe „Avatar: rounded-10". Gesehen hat das
 * niemand: tailwind-merge kannte die Hausskala nicht, das rounded-full der
 * Registry blieb daneben stehen und gewann, und die Flaeche war seit jeher
 * rund. Als die Skala nachgetragen wurde, damit Dialoge ihre 16px bekommen,
 * wurde aus dem Kreis ueber Nacht ein abgerundetes Quadrat.
 *
 * <p>Entschieden wurde daraufhin fuer die Kreisform, weil sie der Stand ist,
 * den alle kennen. Sie steht jetzt ausdruecklich da und nicht mehr als
 * Nebenwirkung: radius-pill ist ein Hausradius, ueberlebt also die
 * Zusammenfuehrung und laesst sich nicht mehr versehentlich verdraengen.
 * <strong>Damit weicht die Flaeche von der Figma-Angabe „rounded-10"
 * ab</strong>; wer sie dorthin zurueckholen will, tauscht die drei
 * radius-pill unten gegen radius-card und zieht den Test nach.
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
  size?: UserAvatarSize
  labelled?: boolean
  className?: string
}) {
  const name = fullNameOf(person)
  const step = AVATAR_SIZES[size]

  return (
    <Avatar
      /* Immer dieselbe Stufe an die Primitive, damit von ihr nur die
         schlichte size-8 kommt und das Mass der Huelle sie verdraengt. */
      size="default"
      aria-hidden={labelled ? undefined : true}
      className={cn("rounded-pill after:rounded-pill", step.box, className)}
    >
      {labelled && <span className="sr-only">{name}</span>}
      {imageUrl && (
        <AvatarImage className="rounded-pill" src={imageUrl} alt="" />
      )}
      <AvatarFallback
        aria-hidden={labelled ? true : undefined}
        className={cn(
          "rounded-pill bg-surface-brand font-bold text-surface-brand-foreground",
          step.initials
        )}
      >
        {initialsOf(person)}
      </AvatarFallback>
    </Avatar>
  )
}
