import { useTranslation } from "react-i18next"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Der sichtbare Platzhalter fuer einen Block, der nicht dargestellt werden
 * kann.
 *
 * <p>Eine leere Flaeche waere hier der schlechteste Ausgang: die lesende
 * Person saehe nicht, dass etwas fehlt, und die schreibende auch nicht. Der
 * Platzhalter steht deshalb an der Stelle des Blocks und nennt, worum es
 * ging.
 *
 * <p>Er komponiert die vorhandene Primitive {@code alert} und baut keine
 * eigene Meldungsflaeche daneben (Skill frontend-shadcn, Abschnitt 1).
 * Nicht {@code empty} beziehungsweise {@code EmptyState}: die tragen einen
 * Leerzustand einer ganzen Ansicht mit eigener Ueberschriftenebene, hier
 * geht es um eine Meldung mitten im Fliesstext, die keine Ueberschrift in
 * die Gliederung des Beitrags ziehen darf.
 *
 * <p><strong>{@code role="note"} statt der {@code role="alert"} der
 * Primitive.</strong> {@code alert} ist eine assertive Live-Region; da der
 * Renderer erst nach dem Laden der Blockliste in den Baum kommt, wuerde
 * jeder nicht darstellbare Block den Screenreader unterbrechen, bei
 * mehreren nacheinander. Angesagt werden soll hier nichts: die Meldung
 * steht im Fliesstext und wird beim Lesen erreicht. Die Prop wird in der
 * Primitive nach {@code role="alert"} gespreadet und ueberschreibt sie
 * damit, ohne die generierte Datei anzufassen.
 *
 * <p>{@code detail} traegt bei einer abgewiesenen Einbettung deren Adresse.
 * Sie erscheint als reiner Text und nie als {@code href}: der Host stand
 * nicht in der Allowlist, und ein Link dorthin waere genau das, was die
 * Allowlist verhindert.
 */
export function UnknownBlockNotice({
  nodeType,
  reason,
  detail,
}: {
  nodeType: string | null
  reason: string
  detail?: string
}) {
  const { t } = useTranslation()
  return (
    <Alert
      role="note"
      variant="destructive"
      data-block="notice"
      data-reason={reason}
    >
      <AlertTitle>{t("projectContent.unknownBlock.title")}</AlertTitle>
      <AlertDescription>
        <p>
          {t("projectContent.unknownBlock.description", {
            nodeType: nodeType ?? t("projectContent.unknownBlock.withoutType"),
          })}
        </p>
        {detail !== undefined ? <p>{detail}</p> : null}
      </AlertDescription>
    </Alert>
  )
}
