import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { resolveApiUrl } from "@/api/client"
import { UserAvatar } from "@/components/common/UserAvatar"
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AVATAR_SIZES,
  fannedGroupWidthRem,
  type UserAvatarSize,
} from "@/lib/avatarSize"
import { fullNameOf, type PersonName } from "@/lib/name"
import { cn } from "@/lib/utils"
import { usePortfolioPath } from "@/features/portfolio/hooks/usePortfolioPath"
import { useBreadcrumbOrigin } from "@/routes/useBreadcrumb"

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
 * So viele Gesichter zeigt die Gruppe, solange niemand darauf zeigt.
 *
 * <p>Drei, weil eine Gruppenarbeit typischerweise zwei bis vier Personen
 * umfasst: darunter zeigt die Kachel fast immer alle, darueber bleibt sie
 * schmal genug fuer eine Kachelspalte. Ein vierter Kreis waere auf 360px
 * bereits der Punkt, an dem die Zeile mit dem Semester darunter kollidiert.
 */
const MAX_FACES = 3

/**
 * Die Personen eines Projekts (§3.3, §3.13; Nacharbeit an KAN-40, verlinkt
 * seit KAN-80).
 *
 * <p><strong>Jeder Name fuehrt zu seinem Portfolio.</strong> Bis KAN-80 waren
 * die Gesichter Bilder ohne Ziel: Wer wissen wollte, was jemand sonst noch
 * gemacht hat, musste den Namen von Hand in die Suche tippen. Jetzt ist jede
 * Person ein Link auf {@code /portfolios/{id}}, an der Kachel wie in der
 * Top-10 und in den Projektdetails.
 *
 * <p><strong>Eine Person bekommt ihren Namen, mehrere bekommen eine
 * Gruppe.</strong> Steht genau eine Person am Projekt, erscheint sie mit
 * Avatar und ausgeschriebenem Namen. Ab zwei Personen zeigt die Flaeche die
 * uebereinanderliegenden Gesichter und, sobald es mehr als {@link MAX_FACES}
 * sind, eine Zahl fuer den Rest. Alle Namen nebeneinander zu setzen ist die
 * naheliegende, aber falsche Antwort: auf einer Kachel bricht die Zeile nach
 * zwei Namen um, und die Reihenfolge liest sich sofort wieder als Rangfolge.
 *
 * <p><strong>Die Gruppe faechert auf, sobald man sie beruehrt</strong>
 * (Entscheidung zu KAN-80). Bei Zeigerkontakt und ebenso, sobald der Fokus
 * hineinlaeuft, ruecken die Kreise auseinander und die verdeckten Personen
 * kommen dazu; die Zahl fuer den Rest verschwindet dabei, sie zaehlt dann
 * nichts mehr. <strong>Reines Hovern genuegt nicht</strong>, deshalb steht
 * {@code group-focus-within} ueberall neben {@code group-hover}: mit der
 * Tastatur gibt es kein Zeigen, und die verdeckten Kreise waeren sonst
 * unerreichbar. Aus demselben Grund sind sie zusammengeschoben und nicht
 * ausgeblendet: was {@code display: none} traegt, nimmt keinen Fokus an, und
 * die Gruppe liesse sich nie oeffnen.
 *
 * <p><strong>Der Platz dafuer ist von Anfang an reserviert.</strong> Die
 * Gruppe traegt als Mindestbreite die Breite ihres aufgefaecherten Zustands
 * ({@code fannedGroupWidthRem}), auch solange sie zugeklappt ist. Ohne das
 * wuchs sie beim Hovern ueber ihre Zeile hinaus, die Kachel brach um und
 * sprang unter dem Zeiger weg; wer dann weiterklicken wollte, traf ins Leere
 * (Befund zu KAN-80). Bezahlt wird das mit etwas leerem Raum rechts der
 * zugeklappten Gruppe, und das ist der guenstigere Preis: eine Kachel, die
 * sich beim Zeigen bewegt, ist nicht bedienbar.
 *
 * <p><strong>Die Zahl ist so gross wie ein Gesicht.</strong> Die Primitive
 * gibt ihr {@code size-8} und schaltet auf {@code size-6} nur um, wenn die
 * Gruppe ein {@code data-size="sm"} enthaelt. Das kann sie hier nie: die
 * Avatarhuelle reicht der Primitive immer {@code size="default"} und setzt
 * ihr Mass selbst (Befund aus KAN-34). Die Zahl war deshalb groesser als die
 * Kreise daneben, und ihr Verschwinden riss ein entsprechend grosses Loch.
 * Sie bekommt jetzt dieselbe Stufe wie die Gesichter.
 *
 * <p><strong>Nichts an der Geometrie wird animiert.</strong> Zusammengeschoben
 * und aufgefaechert sind zwei verschiedene Layouts, und ein Uebergang zwischen
 * ihnen animiert Breiten und Aussenabstaende, also genau die Eigenschaften,
 * die den Browser bei jedem Einzelbild neu rechnen lassen. Das war als
 * Ruckeln zu sehen, und die Elemente daneben tanzten mit. Der Wechsel
 * geschieht deshalb sofort; weich bleibt allein die Deckkraft, und die kostet
 * kein Neuberechnen des Layouts.
 *
 * <p><strong>Der Name steht am Link, nicht daneben.</strong> Frueher trug die
 * Gruppe einen {@code sr-only}-Satz mit allen Namen und war selbst
 * {@code aria-hidden}. Das geht nicht mehr: ein Link ohne zugaenglichen Namen
 * ist ein Verstoss gegen SC 2.4.4, und ein versteckter Satz daneben nennt die
 * Ziele nicht. Jede Person traegt ihren Namen deshalb selbst, sichtbar im
 * Tooltip und vorgelesen als Linktext.
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
  const { t } = useTranslation()
  const origin = useBreadcrumbOrigin()
  /* Der eigene Name fuehrt ins eigene Portfolio und nicht in die
     oeffentliche Fremdsicht (KAN-83); die Regel steht im Hook. */
  const portfolioPath = usePortfolioPath()

  if (people.length === 0) {
    return null
  }

  if (people.length === 1) {
    const person = people[0]
    return (
      <span
        className={cn(
          "type-body-sm relative z-20 flex items-center gap-2 font-medium",
          className
        )}
      >
        {/* z-20: die Kachel ist als Ganzes anklickbar (KAN-80), und ohne
            eigene Ebene laege dieser Link unter der Klickflaeche. */}
        <Link
          to={portfolioPath(person.id)}
          state={origin}
          className="flex items-center gap-2 rounded-selection hover:underline focus-visible:underline"
        >
          <UserAvatar
            person={person}
            imageUrl={avatarSrc(person)}
            size={size}
          />
          <span>{fullNameOf(person)}</span>
        </Link>
      </span>
    )
  }

  const rest = people.length - MAX_FACES

  return (
    <TooltipProvider>
      <span
        className={cn(
          "group/people type-body-sm relative z-20 flex items-center gap-2 font-medium",
          className
        )}
      >
        <span className="sr-only">{t("project.people.label")}</span>
        {/* -space-x-2 kommt aus der Primitive; aufgefaechert wird ueber den
            Abstand, damit die Kreise dabei nicht springen. */}
        <AvatarGroup
          /* Der Platz des aufgefaecherten Zustands, schon im zugeklappten:
             so aendert das Auffaechern die Zeilenbreite nicht mehr. max-w-full
             ist die Reissleine fuer den unwahrscheinlichen Fall einer sehr
             grossen Gruppe in einer schmalen Kachel; dort ueberlappen die
             Kreise dann eben staerker, statt aus der Karte zu laufen. */
          style={{ minWidth: `${fannedGroupWidthRem(people.length, size)}rem` }}
          className="max-w-full group-focus-within/people:space-x-1 group-hover/people:space-x-1"
        >
          {people.map((person, index) => (
            <Tooltip key={person.id}>
              <TooltipTrigger
                render={
                  <Link
                    to={portfolioPath(person.id)}
                    state={origin}
                    className={cn(
                      "rounded-pill transition-opacity",
                      /* Die verdeckten Personen sind zusammengeschoben statt
                         ausgeblendet: nur so bleiben sie fokussierbar, und
                         der erste Tabstopp oeffnet die ganze Gruppe. Die
                         Breite springt ohne Uebergang, siehe Klassenkopf. */
                      index >= MAX_FACES &&
                        "max-w-0 opacity-0 group-focus-within/people:max-w-none group-focus-within/people:opacity-100 group-hover/people:max-w-none group-hover/people:opacity-100"
                    )}
                  />
                }
              >
                <UserAvatar
                  person={person}
                  imageUrl={avatarSrc(person)}
                  size={size}
                  labelled
                />
              </TooltipTrigger>
              <TooltipContent>{fullNameOf(person)}</TooltipContent>
            </Tooltip>
          ))}
          {rest > 0 && (
            /* Die Zahl nennt den Rest und nicht die Gesamtzahl, wie im
               Registry-Beispiel: neben drei Gesichtern liest sich "+2" als
               "zwei weitere", "5" dagegen als Widerspruch zu dem, was
               danebensteht. Aufgefaechert zaehlt sie nichts mehr und
               verschwindet; vorgelesen wird sie nie, die Namen stehen an
               den Links.

               Sie geht ueber max-w-0 und Deckkraft und nicht ueber hidden:
               ein display:none nimmt sie schlagartig aus dem Fluss, und die
               Kreise daneben sprangen im selben Augenblick nach links. */
            <AvatarGroupCount
              aria-hidden="true"
              className={cn(
                "type-label-xs shrink-0 overflow-hidden transition-opacity",
                AVATAR_SIZES[size].box,
                "group-focus-within/people:max-w-0 group-focus-within/people:opacity-0 group-hover/people:max-w-0 group-hover/people:opacity-0"
              )}
            >
              +{rest}
            </AvatarGroupCount>
          )}
        </AvatarGroup>
      </span>
    </TooltipProvider>
  )
}

/**
 * Die Referenz {@code /api/files/{id}} wird zur abrufbaren Adresse; ohne
 * Bild bleibt es bei den Initialen (§3.15.1).
 */
function avatarSrc(person: DisplayPerson): string | undefined {
  return person.avatarUrl ? resolveApiUrl(person.avatarUrl) : undefined
}
