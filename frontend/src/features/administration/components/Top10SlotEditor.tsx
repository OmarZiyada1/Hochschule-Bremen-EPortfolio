import { TrophyIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { Top10EntryResponse } from "@/api/types"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { RemoveFromTop10Dialog } from "@/features/administration/components/RemoveFromTop10Dialog"
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
  TOP10_SLOT_COUNT,
  type Top10Slots,
} from "@/features/administration/top10Slots"

/**
 * Die zehn Plaetze der Top-10 mit ihren Handlungen (Frame {@code Admin ·
 * Top 10}, KAN-40): umsortieren, Platz raeumen, Projekt aufnehmen.
 *
 * <p><strong>Jede Handlung wirkt sofort.</strong> Einen Knopf „Reihenfolge
 * speichern" gibt es nicht mehr. Er war frueher noetig, weil eine Luecke
 * sich nicht ablegen liess und die Oberflaeche deshalb einen Zustand
 * mitschleppte, den der Server nicht kannte; seit Contract v78 traegt
 * {@code PUT /admin/top10} den freien Platz als {@code null} mit, und was zu
 * sehen ist, ist damit auch gespeichert (Entscheidung zur Nacharbeit an
 * KAN-40).
 *
 * <p><strong>Es gibt deshalb keinen Arbeitszustand mehr.</strong> Die
 * Plaetze kommen unmittelbar aus der Serverantwort; der Zug wird
 * vorhergesagt und im Cache abgelegt ({@code useSaveTop10Order}), nicht in
 * einem zweiten Zustand daneben gehalten. Das ist der eigentliche Gewinn:
 * ein halb umsortierter Stand, den niemand gespeichert hat, kann nicht mehr
 * entstehen.
 *
 * <p><strong>Nur das Entfernen fragt zurueck.</strong> Ein Zug um einen
 * Platz ist mit dem Gegenzug erledigt; ein entferntes Projekt ist von der
 * Startseite verschwunden, und der Papierkorb sitzt neben zwei Pfeilen, die
 * man mehrfach hintereinander drueckt.
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
  const slots = buildSlots(entries)
  const [removing, setRemoving] = useState<{
    index: number
    title: string
  } | null>(null)

  const filled = TOP10_SLOT_COUNT - freePositions(slots).length

  /**
   * Schickt die neue Belegung, sofern sie sich von der gezeigten
   * unterscheidet. Ein Klick ohne Wirkung erzeugt sonst einen
   * Schreibvorgang und damit eine Protokollzeile (§3.17).
   */
  function apply(next: Top10Slots, message: string) {
    if (!hasOrderChanged(next, slots)) {
      return
    }
    save.mutate(next, { onSuccess: () => onNotice(message) })
  }

  return (
    <section aria-labelledby="top10-slots" className="flex flex-col gap-4">
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

      {/* Der Fehler steht hier und nicht im Dialog: Verschieben und
          Aufnehmen haben keinen, an dem er stehen koennte. Beim Entfernen
          zeigt ihn zusaetzlich der Dialog, der dann offen bleibt. */}
      {save.error !== null && removing === null && (
        <Alert variant="destructive">
          <AlertTitle>
            {isApiError(save.error)
              ? t(apiErrorMessageKey(save.error), {
                  defaultValue: save.error.message,
                })
              : t("apiError.INTERNAL_ERROR")}
          </AlertTitle>
        </Alert>
      )}

      <Top10SlotList
        slots={slots}
        disabled={save.isPending}
        onMove={(index, direction) => {
          const moved = slots[index]
          const next = moveSlot(slots, index, direction)
          if (moved === null) {
            return
          }
          const target = next.findIndex(
            (slot) => slot?.project.id === moved.project.id
          )
          apply(
            next,
            t("administration.top10.slot.moved", {
              title: moved.project.title,
              position: target + 1,
            })
          )
        }}
        onRemove={(index) => {
          const slot = slots[index]
          if (slot !== null) {
            setRemoving({ index, title: slot.project.title })
          }
        }}
      />

      <Card>
        <CardContent>
          <Top10ProjectPicker
            full={isFull(slots)}
            isSelected={(projectId) => containsProject(slots, projectId)}
            pending={save.isPending}
            onAdd={(project) => {
              const next = addProject(slots, project)
              const target = next.findIndex(
                (slot) => slot?.project.id === project.id
              )
              apply(
                next,
                t("administration.top10.picker.added", {
                  title: project.title,
                  position: target + 1,
                })
              )
            }}
          />
        </CardContent>
      </Card>

      <RemoveFromTop10Dialog
        title={removing?.title ?? null}
        position={removing === null ? null : removing.index + 1}
        pending={save.isPending}
        error={save.error}
        onOpenChange={(open) => {
          if (!open) {
            save.reset()
            setRemoving(null)
          }
        }}
        onConfirm={() => {
          if (removing === null) {
            return
          }
          const { index, title } = removing
          save.mutate(clearSlot(slots, index), {
            onSuccess: () => {
              setRemoving(null)
              onNotice(
                t("administration.top10.slot.removed", {
                  title,
                  position: index + 1,
                })
              )
            },
          })
        }}
      />
    </section>
  )
}
