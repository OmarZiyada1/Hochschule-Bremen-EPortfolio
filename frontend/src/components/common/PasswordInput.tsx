import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

/**
 * Passwortfeld mit Sichtbarkeitsschalter (KAN-67, Figma-Komponente
 * "PasswordInput"): rechts im Feld sitzt ein Knopf, der die Eingabe
 * abwechselnd verborgen und im Klartext zeigt.
 *
 * Der Zustand bleibt in dieser Komponente. Jedes Feld schaltet damit fuer
 * sich, was bei Passwort und Bestaetigung Absicht ist: ein gemeinsamer
 * Schalter wuerde den Zweck der Bestaetigung entwerten.
 *
 * Barrierefreiheit (§2.5, WCAG 2.2): der erreichbare Name des Knopfes
 * wechselt mit dem Zustand, statt einen festen Namen zu fuehren und den
 * Zustand nur im Bild zu zeigen. Das Icon selbst traegt keinen Namen. Der
 * Knopf ist `type="button"` (Vorgabe der Primitive) und sendet das
 * Formular deshalb nicht ab; `size="icon-xs"` ergibt 24px Zielgroesse
 * (SC 2.5.8).
 *
 * `type` ist bewusst nicht ueberschreibbar: es ist der Schalter selbst.
 * Alle uebrigen Eigenschaften laufen an das echte Eingabefeld durch, damit
 * `aria-invalid`, `aria-describedby` und `autoComplete` der aufrufenden
 * Seite wie bei `Input` wirken.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  return (
    <InputGroup className={className}>
      <InputGroupInput {...props} type={visible ? "text" : "password"} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={
            visible ? t("common.password.hide") : t("common.password.show")
          }
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <EyeOffIcon aria-hidden="true" />
          ) : (
            <EyeIcon aria-hidden="true" />
          )}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
