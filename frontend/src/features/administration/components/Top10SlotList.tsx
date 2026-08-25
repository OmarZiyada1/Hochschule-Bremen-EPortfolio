import { ArrowDownIcon, ArrowUpIcon, ImageIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { resolveApiUrl } from "@/api/client"
import { Tag } from "@/components/common/Tag"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  canMoveDown,
  canMoveUp,
  type Top10Slots,
} from "@/features/administration/top10Slots"
import { fullNameOf } from "@/lib/name"
import { cn } from "@/lib/utils"

/**
 * Die zehn Plaetze der Top-10 (Frame {@code Admin · Top 10}, KAN-40): je
 * Platz eine Vorschaukachel mit Titel, Coverbild und Fakultaet, dazu die
 * Handlungen der Zeile.
 *
 * <p><strong>Eine geordnete Liste, kein Stapel von Kaesten.</strong> Die
 * Reihenfolge <em>ist</em> die Aussage dieser Ansicht; ein {@code ol} sagt
 * das auch denen, die die Seite vorgelesen bekommen (SC 1.3.1). Ein freier
 * Platz ist ein eigener Listeneintrag mit dem Text „Platz frei" und keine
 * leere Flaeche: sonst waere aus der Ansage nicht zu erschliessen, dass es
 * ihn gibt.
 *
 * <p><strong>Umsortiert wird ueber Schaltflaechen, nicht ueber
 * Ziehen.</strong> Eine Ziehbewegung ist eine reine Zeigergeste und braucht
 * zwingend eine gleichwertige Bedienung ohne Ziehen (SC 2.1.1, SC 2.5.7);
 * sind die Schaltflaechen ohnehin da, ist das Ziehen nur noch Zierat. Dazu
 * kommt, dass keine Sortierbibliothek freigegeben ist (Frontend-Regel 9) und
 * die Galerie im Editor ihre Bilder seit KAN-73 ebenso umordnet.
 *
 * <p><strong>Gespeichert wird nicht je Klick.</strong> Die Knoepfe aendern
 * allein den Arbeitszustand; hinaus geht erst „Reihenfolge speichern", und
 * zwar als vollstaendige Liste. Sonst entstuende je Klick ein
 * Schreibvorgang und je Schreibvorgang eine Protokollzeile (§3.17).
 */
export function Top10SlotList({
  slots,
  onMove,
  onRemove,
  disabled = false,
}: {
  slots: Top10Slots
  onMove: (index: number, direction: "up" | "down") => void
  onRemove: (index: number) => void
  /** Waehrend des Speicherns gesperrt, damit kein Zug ins Leere laeuft. */
  disabled?: boolean
}) {
  const { t, i18n } = useTranslation()
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
  })

  return (
    /* Die Liste traegt einen eigenen Namen: die Ueberschrift darueber
       gehoert zum Abschnitt, und eine Elementliste zeigt Listen ohne Namen
       nur als „Liste mit 10 Eintraegen" (SC 1.3.1). */
    <ol
      aria-label={t("administration.top10.slot.listLabel")}
      className="flex flex-col gap-3"
    >
      {slots.map((slot, index) => {
        const position = index + 1
        return (
          <li key={position}>
            <Card size="sm" className={cn(slot === null && "border-dashed")}>
              <CardContent className="flex items-center gap-4">
                {/* Die Platzziffer laeuft zweispurig: sichtbar die blosse
                    Zahl wie im Frame, vorgelesen als ganzer Satz. „8"
                    allein sagt nicht, wofuer die Zahl steht. */}
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary font-bold text-primary-foreground">
                  <span className="sr-only">
                    {t("top10.position", { position })}
                  </span>
                  <span aria-hidden="true">{position}</span>
                </span>

                {slot === null ? (
                  <p className="type-body-sm text-muted-foreground">
                    {t("administration.top10.slot.free")}
                  </p>
                ) : (
                  <>
                    <div className="surface-cover hidden h-12 w-16 shrink-0 overflow-hidden rounded-control sm:block">
                      {slot.project.coverImageUrl === null ? (
                        <div className="flex size-full items-center justify-center">
                          <ImageIcon
                            aria-hidden="true"
                            className="size-5 text-cover-foreground/70"
                          />
                        </div>
                      ) : (
                        /* Ueber resolveApiUrl und nicht ueber den nackten
                           Pfad: die Adresse landet im src eines img und
                           laeuft nie durch request(), die Basis-URL
                           muesste sie also selbst tragen. Ein Token
                           braucht es nicht, die Top-10 fuehrt nur
                           veroeffentlichte Projekte (§3.15). */
                        <img
                          src={resolveApiUrl(slot.project.coverImageUrl)}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h3 className="type-body font-semibold">
                        <Link
                          to={`/projects/${slot.project.id}`}
                          className="text-primary hover:underline focus-visible:underline"
                        >
                          {slot.project.title}
                        </Link>
                      </h3>
                      <p className="type-body-sm text-muted-foreground">
                        {fullNameOf(slot.project.author)}
                        {slot.addedAt !== null &&
                          ` · ${t("administration.top10.slot.since", {
                            date: dateFormat.format(new Date(slot.addedAt)),
                          })}`}
                      </p>
                      {/* Ohne eigene Farbe: Fakultaeten werden nicht
                          farblich codiert (Confluence
                          „Designentscheidungen", Abschnitt 2.4). */}
                      {slot.project.faculty !== null && (
                        <span>
                          <Tag>{slot.project.faculty.name}</Tag>
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled || !canMoveUp(slots, index)}
                        onClick={() => onMove(index, "up")}
                      >
                        <ArrowUpIcon aria-hidden="true" />
                        <span className="sr-only">
                          {t("administration.top10.slot.moveUp", {
                            title: slot.project.title,
                            position,
                          })}
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled || !canMoveDown(slots, index)}
                        onClick={() => onMove(index, "down")}
                      >
                        <ArrowDownIcon aria-hidden="true" />
                        <span className="sr-only">
                          {t("administration.top10.slot.moveDown", {
                            title: slot.project.title,
                            position,
                          })}
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        onClick={() => onRemove(index)}
                      >
                        <Trash2Icon aria-hidden="true" />
                        <span className="sr-only">
                          {t("administration.top10.slot.remove", {
                            title: slot.project.title,
                          })}
                        </span>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ol>
  )
}
