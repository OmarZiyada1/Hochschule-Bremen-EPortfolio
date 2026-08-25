import { TrophyIcon } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type { Top10EntryResponse } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SaveTop10OrderDialog } from "@/features/administration/components/SaveTop10OrderDialog"
import { Top10ProjectPicker } from "@/features/administration/components/Top10ProjectPicker"
import { Top10SlotList } from "@/features/administration/components/Top10SlotList"
import { useSaveTop10Order } from "@/features/administration/hooks/useAdminTop10"
import {
  addProject,
  buildSlots,
  clearSlot,
  containsProject,
  freePositions,
  hasOrderChanged,
  isFull,
  moveSlot,
  orderedProjectIds,
  TOP10_SLOT_COUNT,
  type Top10Slots,
} from "@/features/administration/top10Slots"

/**
 * Die zehn Plaetze mit ihren Handlungen (Frame {@code Admin · Top 10},
 * KAN-40): umsortieren, Platz raeumen, Projekt aufnehmen, Reihenfolge
 * speichern.
 *
 * <p><strong>Der Arbeitszustand liegt hier und nicht auf dem Server.</strong>
 * Die drei Handlungen aendern zunaechst nur ihn; hinaus geht erst
 * „Reihenfolge speichern", und zwar als vollstaendige, geordnete Liste
 * (§3.11.1 Regel 3). Sonst entstuende je Klick ein Schreibvorgang und je
 * Schreibvorgang eine Protokollzeile, und der Verlauf einer einzigen
 * Umsortierung waere zwanzig Zeilen lang (§3.17).
 *
 * <p><strong>Gespeichert wird nach einer Rueckfrage</strong>, die nennt, was
 * seinen Platz verliert: {@code PUT /admin/top10} ersetzt die Liste, und das
 * Wegnehmen einer Kachel waere sonst der einzige Schritt dieser Ansicht, der
 * stillschweigend wirkt.
 */
export function Top10SlotEditor({
  entries,
  onNotice,
}: {
  entries: readonly Top10EntryResponse[]
  /** Ansage nach jeder Aenderung, fuer die Live-Region der Seite (SC 4.1.3). */
  onNotice: (message: string) => void
}) {
  const { t } = useTranslation()
  const save = useSaveTop10Order()
  const original = buildSlots(entries)
  const [slots, setSlots] = useState<Top10Slots>(original)
  const [confirming, setConfirming] = useState(false)
  const saveTrigger = useRef<HTMLButtonElement | null>(null)

  const changed = hasOrderChanged(slots, original)
  const filled = TOP10_SLOT_COUNT - freePositions(slots).length
  const removedTitles = original.flatMap((slot) =>
    slot !== null && !containsProject(slots, slot.project.id)
      ? [slot.project.title]
      : []
  )

  return (
    <section aria-labelledby="top10-slots" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="top10-slots" className="type-h2 flex items-center gap-2">
          <TrophyIcon aria-hidden="true" className="size-5 text-primary" />
          {t("administration.top10.slots.title")}
          <span className="type-body-sm text-muted-foreground">
            {t("administration.top10.slots.count", {
              filled,
              total: TOP10_SLOT_COUNT,
            })}
          </span>
        </h2>
        <Button
          ref={saveTrigger}
          type="button"
          /* Gesperrt, solange sich nichts geaendert hat: sonst schriebe ein
             Klick eine Protokollzeile ohne Anlass. Verglichen wird die
             Nutzlast und nicht die Anzeige, eine bloss verschobene Luecke
             aendert am Ergebnis nichts. */
          disabled={!changed || save.isPending}
          onClick={() => setConfirming(true)}
        >
          {t("administration.top10.save.action")}
        </Button>
      </div>

      <Top10SlotList
        slots={slots}
        disabled={save.isPending}
        onMove={(index, direction) => {
          const moved = slots[index]
          const next = moveSlot(slots, index, direction)
          setSlots(next)
          if (moved === null) {
            return
          }
          const target = next.findIndex(
            (slot) => slot?.project.id === moved.project.id
          )
          onNotice(
            t("administration.top10.slot.moved", {
              title: moved.project.title,
              position: target + 1,
            })
          )
        }}
        onRemove={(index) => {
          const removed = slots[index]
          setSlots(clearSlot(slots, index))
          if (removed !== null) {
            onNotice(
              t("administration.top10.slot.removed", {
                title: removed.project.title,
              })
            )
          }
        }}
      />

      <Card>
        <CardContent>
          <Top10ProjectPicker
            full={isFull(slots)}
            isSelected={(projectId) => containsProject(slots, projectId)}
            onAdd={(project) => {
              setSlots(addProject(slots, project))
              onNotice(
                t("administration.top10.picker.added", {
                  title: project.title,
                })
              )
            }}
          />
        </CardContent>
      </Card>

      <SaveTop10OrderDialog
        open={confirming}
        onOpenChange={(next) => {
          if (!next) {
            save.reset()
          }
          setConfirming(next)
        }}
        removedTitles={removedTitles}
        count={filled}
        pending={save.isPending}
        error={save.error}
        finalFocus={saveTrigger}
        onConfirm={() =>
          save.mutate(orderedProjectIds(slots), {
            onSuccess: () => {
              setConfirming(false)
              onNotice(t("administration.top10.save.done", { count: filled }))
            },
          })
        }
      />
    </section>
  )
}
