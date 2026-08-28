import { ListPlusIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { top10PlacementBlockReason } from "@/features/administration/top10Placement"

/**
 * Der Menueeintrag „In die Top 10 aufnehmen" der Projektverwaltung mit seinen
 * vier Zustaenden (§3.11.1, §5 Zeile „Top-10 kuratieren"; Nacharbeit an
 * KAN-87).
 *
 * <p><strong>Er ersetzt an dieser Stelle „Fuer Top-10 nominieren".</strong>
 * KAN-87 hatte den Nominierungseintrag hierher gelegt, damit auch ein Admin
 * ohne Zuweisung ein Projekt vorschlagen kann. Das beschreibt seine Rolle
 * aber falsch herum: In der Administration <em>entscheidet</em> er, er
 * schlaegt nicht vor. Ein Vorschlag, den dieselbe Person danach selbst
 * annimmt, ist ein Umweg mit zwei Protokollzeilen fuer einen Vorgang. Der
 * Nominierungsweg bleibt ihm dort, wo er als Redaktion arbeitet: in „Meine
 * Reviews" und auf der Projektdetailseite.
 *
 * <p><strong>Die Beschriftung sagt das Ergebnis.</strong> „Aufnehmen" ist das
 * Wort, das die Oberflaeche fuer diesen Vorgang schon benutzt (Projekt-Picker
 * der Top-10-Verwaltung, „Nur veroeffentlichte Projekte lassen sich
 * aufnehmen", Stufe TOP_10 als „Aufnahme in die Liste"), und sein
 * Gegenstueck heisst bereits „Vom Platz nehmen". Ein neues Verb daneben
 * haette dieselbe Handlung mit zwei Namen versehen.
 *
 * <p><strong>Gesperrt heisst {@code aria-disabled} und nicht
 * {@code disabled}</strong>, aus demselben Grund wie beim
 * {@code NominateMenuItem}: ein wirklich gesperrter Eintrag ist nicht mehr
 * fokussierbar, und die Erklaerung nach SC 3.3.2 saehe dann nur, wer mit der
 * Maus darueberfaehrt. Base UIs {@code MenuItem} schliesst das Menue auch bei
 * {@code aria-disabled}, deshalb steht dort {@code closeOnClick={false}}.
 *
 * <p><strong>„Steht bereits in der Top 10" traegt keinen Hinweis</strong>,
 * die Beschriftung sagt bereits alles. Die beiden uebrigen Sperren behalten
 * die gewohnte Beschriftung und erklaeren sich im Kurzhinweis.
 */
export function Top10PlacementMenuItem({
  blocked,
  onPlace,
}: {
  blocked: ReturnType<typeof top10PlacementBlockReason>
  onPlace: () => void
}) {
  const { t } = useTranslation()

  const item = (
    <DropdownMenuItem
      aria-disabled={blocked !== null}
      className={blocked !== null ? "text-text-disabled" : undefined}
      closeOnClick={blocked === null}
      onClick={() => {
        if (blocked === null) {
          onPlace()
        }
      }}
    >
      <ListPlusIcon aria-hidden="true" />
      {blocked === "inTop10"
        ? t("administration.top10.place.blocked.inTop10Short")
        : t("administration.top10.place.action")}
    </DropdownMenuItem>
  )

  if (blocked === null || blocked === "inTop10") {
    return item
  }

  return (
    <Tooltip>
      <TooltipTrigger render={item} />
      <TooltipContent side="left">
        {t(`administration.top10.place.blocked.${blocked}`)}
      </TooltipContent>
    </Tooltip>
  )
}
