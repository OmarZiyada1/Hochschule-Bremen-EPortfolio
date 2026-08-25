import { useTranslation } from "react-i18next"

import { resolveApiUrl } from "@/api/client"
import { UserAvatar, type UserAvatarSize } from "@/components/common/UserAvatar"
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { fullNameOf, type PersonName } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Eine Person, wie sie an einer Projektantwort haengt: Name und, wenn
 * hinterlegt, das Profilbild aus dem Portfolio (§3.2). Deckungsgleich mit
 * {@code PersonResponse} und, seit Contract v78, mit {@code MemberResponse}.
 */
export interface DisplayPerson extends PersonName {
  id: string
  avatarUrl?: string | null
}

/**
 * So viele Gesichter zeigt die Gruppe, bevor der Rest zur Zahl wird.
 *
 * <p>Drei, weil eine Gruppenarbeit typischerweise zwei bis vier Personen
 * umfasst: darunter zeigt die Kachel fast immer alle, darueber bleibt sie
 * schmal genug fuer eine Kachelspalte. Ein vierter Kreis waere auf 360px
 * bereits der Punkt, an dem die Zeile mit dem Semester darunter kollidiert.
 */
const MAX_FACES = 3

/**
 * Die Personen eines Projekts (§3.3, §3.13; Nacharbeit an KAN-40).
 *
 * <p><strong>Eine Person bekommt ihren Namen, mehrere bekommen eine
 * Gruppe.</strong> Steht genau eine Person am Projekt, erscheint sie mit
 * Avatar und ausgeschriebenem Namen wie bisher. Ab zwei Personen zeigt die
 * Flaeche nur noch die Gesichter und, sobald es mehr als
 * {@link MAX_FACES} sind, eine Zahl fuer den Rest.
 *
 * <p><strong>Warum die Namen dann verschwinden.</strong> Bis zur Nacharbeit
 * an KAN-40 stand an jeder Kachel allein die Autor:in. Eine Gruppenarbeit
 * lief damit ueberall unter einem einzigen Namen, und die Mitwirkenden waren
 * unsichtbar. Alle Namen nebeneinander zu setzen ist die naheliegende, aber
 * falsche Antwort: auf einer Kachel bricht die Zeile nach zwei Namen um, und
 * die Reihenfolge der Namen liest sich sofort wieder als Rangfolge. Die
 * Gruppe sagt stattdessen, was zutrifft, naemlich dass mehrere daran
 * gearbeitet haben; wer wissen will, wer, oeffnet das Projekt.
 *
 * <p><strong>Verschwunden sind die Namen nur optisch.</strong> Fuer
 * Hilfsmittel steht der vollstaendige Satz da, mit allen Namen und in der
 * Sprache der Oberflaeche zusammengefuegt. Ein Bild ohne Namen waere fuer
 * einen Screenreader nichts, und der Befund aus KAN-29 gilt hier genauso:
 * ein Text im DOM, den {@code aria-hidden} verdeckt, wird nie vorgelesen.
 *
 * <p><strong>Die Schriftfarbe setzt der Aufrufer.</strong> Dieselbe Gruppe
 * steht mal auf einer Karte und mal auf einer Coverflaeche, und dort traegt
 * die Vorlage {@code text-cover-muted} statt {@code text-muted-foreground}.
 * Eine feste Farbe hier waere auf dem Cover eine Kontrastzusage, die nicht
 * haelt (SC 1.4.3); der Ton kommt deshalb ueber {@code className}.
 *
 * <p><strong>Die Gruppe kommt aus der Registry</strong>
 * ({@code AvatarGroup}, {@code AvatarGroupCount} in
 * {@code components/ui/avatar.tsx}); von Hand entsteht hier nur die Regel,
 * ab wann sie greift. Zaehlen muss die Huelle selbst, die Primitive bringt
 * dafuer kein {@code max} mit.
 */
export function ProjectPeople({
  people,
  size = "sm",
  className,
}: {
  /**
   * Alle Beteiligten in Anzeigereihenfolge, die Autor:in zuerst. Eine leere
   * Liste zeigt nichts; ein Projekt ohne Personen gibt es fachlich nicht,
   * und ein Platzhalter waere eine Behauptung.
   */
  people: readonly DisplayPerson[]
  size?: UserAvatarSize
  className?: string
}) {
  const { t, i18n } = useTranslation()

  if (people.length === 0) {
    return null
  }

  if (people.length === 1) {
    const person = people[0]
    return (
      <span
        className={cn(
          "type-body-sm flex items-center gap-2 font-medium",
          className
        )}
      >
        <UserAvatar
          person={person}
          imageUrl={
            person.avatarUrl ? resolveApiUrl(person.avatarUrl) : undefined
          }
          size={size}
        />
        <span>{fullNameOf(person)}</span>
      </span>
    )
  }

  const faces = people.slice(0, MAX_FACES)
  const rest = people.length - faces.length

  /* Ueber Intl statt ueber einen i18n-Schluessel mit Komma: die Konjunktion
     und ihre Zeichensetzung unterscheiden sich je Sprache ("A, B und C"
     gegen "A, B, and C"), und genau das ist die Aufgabe von ListFormat. */
  const names = new Intl.ListFormat(i18n.language, {
    style: "long",
    type: "conjunction",
  }).format(people.map(fullNameOf))

  return (
    <span
      className={cn("type-body-sm flex items-center gap-2 font-medium", className)}
    >
      <span className="sr-only">{t("project.people.by", { names })}</span>
      <AvatarGroup aria-hidden="true">
        {faces.map((person) => (
          <UserAvatar
            key={person.id}
            person={person}
            imageUrl={
              person.avatarUrl ? resolveApiUrl(person.avatarUrl) : undefined
            }
            size={size}
          />
        ))}
        {rest > 0 && (
          /* Die Zahl nennt den Rest und nicht die Gesamtzahl, wie im
             Registry-Beispiel: neben drei Gesichtern liest sich "+2" als
             "zwei weitere", "5" dagegen als Widerspruch zu dem, was
             danebensteht. */
          <AvatarGroupCount className="type-label-xs">
            +{rest}
          </AvatarGroupCount>
        )}
      </AvatarGroup>
    </span>
  )
}
