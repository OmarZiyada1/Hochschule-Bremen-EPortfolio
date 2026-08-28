import { TrophyIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { nominationBlockReason } from "@/features/reviews/nominationBlock"

/**
 * Der Menueeintrag „Fuer Top-10 nominieren" mit seinen vier Zustaenden
 * (§3.11.1; KAN-37, seit KAN-87 an zwei Stellen).
 *
 * <p><strong>Eine eigene Datei, weil ihn zwei Zeilenmenues zeigen:</strong>
 * „Meine Reviews" und die Projektverwaltung. Ihn ein zweites Mal zu
 * schreiben hiesse, zwei Fassungen derselben Zusagen zu pflegen; dieselbe
 * Ueberlegung wie beim {@code PrintTrigger} seit KAN-83.
 *
 * <p><strong>Gesperrt heisst {@code aria-disabled} und nicht
 * {@code disabled}.</strong> Ein wirklich gesperrter Eintrag ist nicht mehr
 * fokussierbar, und damit waere der Hinweis fuer die Tastatur unerreichbar:
 * genau die Erklaerung, die SC 3.3.2 verlangt, saehe dann nur, wer mit der
 * Maus darueberfaehrt. Base UIs {@code MenuItem} schliesst das Menue
 * allerdings auch bei {@code aria-disabled} ({@code closeOnClick} steht auf
 * true), und ein Menue, das sich ohne Wirkung und ohne Meldung schliesst,
 * laesst den Hinweis nie zu Ende lesen; gesperrte Eintraege setzen deshalb
 * {@code closeOnClick={false}}. Gedaempft wird ueber die Rolle
 * {@code text-disabled} und nicht ueber {@code opacity}, sonst faellt die
 * Beschriftung unter den Kontrastwert (SC 1.4.3).
 *
 * <p><strong>„Bereits nominiert" traegt keinen Hinweis</strong>, die
 * Beschriftung sagt bereits alles. Die beiden uebrigen Sperren behalten die
 * gewohnte Beschriftung und erklaeren sich im Kurzhinweis; ein Eintrag,
 * dessen Text je nach Grund wechselt, waere schwerer wiederzufinden.
 *
 * <p>Der Kurzhinweis muss den Eintrag umschliessen ({@code TooltipTrigger}
 * rendert sein Kind), und genau deshalb ist das hier eine Komponente und
 * kein Ausdruck im Menue: ein Eintrag, der zwischen zwei Formen wechselt,
 * waere dort schlecht zu lesen.
 */
export function NominateMenuItem({
  blocked,
  onNominate,
}: {
  blocked: ReturnType<typeof nominationBlockReason>
  onNominate: () => void
}) {
  const { t } = useTranslation()

  const item = (
    <DropdownMenuItem
      aria-disabled={blocked !== null}
      className={blocked !== null ? "text-text-disabled" : undefined}
      closeOnClick={blocked === null}
      onClick={() => {
        if (blocked === null) {
          onNominate()
        }
      }}
    >
      <TrophyIcon aria-hidden="true" />
      {blocked === "nominated"
        ? t("review.list.row.nominateBlocked.nominated")
        : t("review.list.row.nominate")}
    </DropdownMenuItem>
  )

  if (blocked === null || blocked === "nominated") {
    return item
  }

  return (
    <Tooltip>
      <TooltipTrigger render={item} />
      <TooltipContent side="left">
        {t(`review.list.row.nominateBlocked.${blocked}`)}
      </TooltipContent>
    </Tooltip>
  )
}
