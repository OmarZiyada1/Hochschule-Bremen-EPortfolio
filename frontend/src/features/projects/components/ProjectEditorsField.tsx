import { XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useId, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Tag } from "@/components/common/Tag"
import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { PersonCombobox } from "@/features/projects/components/PersonCombobox"
import type { PersonValue } from "@/features/projects/ProjectMetadataForm.schema"
import { fullNameOf } from "@/lib/name"

/**
 * Die Redaktionszuweisung des Metadatenformulars (§3.3, §5 Fussnote 3,
 * KAN-35): ein Suchfeld ueber {@code GET /api/users/lookup?role=EDITOR},
 * darunter die gewaehlten Personen als Pillen.
 *
 * <p><strong>Mehrfachauswahl, obwohl das Template ein Feld zeigt.</strong>
 * §3.3 fuehrt {@code editors} als N:M, §6.1 {@code editorIds} als Liste;
 * das Template zeigt den einfachsten Fall. Entschieden in der
 * Klaerungsrunde zu KAN-35.
 *
 * <p><strong>Die eigene Person steht nicht zur Auswahl.</strong> Wer sein
 * Projekt selbst anlegt und dabei EDITOR ist, koennte sich sonst als
 * zustaendige Redaktion eintragen und danach feststellen, dass das
 * Vier-Augen-Prinzip aus §4.1 sie am Genehmigen hindert. Ein Feld, das eine
 * Wahl anbietet, die spaeter folgenlos bleibt, ist schlimmer als eines, das
 * sie gar nicht erst zeigt.
 *
 * <p><strong>Aenderbar nur im {@code DRAFT}</strong> (§5, Fussnote 3).
 * Danach fuehrt der Weg ueber die Administration, und das Feld steht
 * schreibgeschuetzt da und nennt den Grund. Der Server prueft das ohnehin;
 * die Oberflaeche spiegelt die Regel, sie ersetzt sie nicht.
 */
export function ProjectEditorsField({
  value,
  onChange,
  currentUserId,
  disabled = false,
  readOnlyReason,
  labelSuffix,
}: {
  value: PersonValue[]
  onChange: (next: PersonValue[]) => void
  /** Eigenes Konto, wird aus der Vorschlagsliste ausgeblendet. */
  currentUserId?: string
  disabled?: boolean
  /**
   * Warum das Feld nicht mehr aenderbar ist. Gesetzt heisst zugleich: keine
   * Suche, nur die Anzeige der bereits zugewiesenen Redaktion.
   */
  readOnlyReason?: string
  /** Kennzeichnung "erforderlich zum Einreichen" hinter der Beschriftung. */
  labelSuffix?: ReactNode
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const listLabelId = `${inputId}-chosen`

  const locked = disabled || readOnlyReason !== undefined

  const excludedIds = useMemo(
    () => [
      ...value.map((person) => person.id),
      ...(currentUserId === undefined ? [] : [currentUserId]),
    ],
    [value, currentUserId]
  )

  function add(person: { id: string; firstName: string; lastName: string }) {
    if (value.some((entry) => entry.id === person.id)) {
      return
    }
    onChange([
      ...value,
      {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
      },
    ])
  }

  function remove(personId: string) {
    onChange(value.filter((entry) => entry.id !== personId))
  }

  return (
    <div className="flex flex-col gap-2">
      {locked ? (
        <>
          {/* Kein Eingabefeld, wenn nichts einzugeben ist: ein gesperrtes
              Suchfeld sieht bedienbar aus und ist es nicht. Die Beschriftung
              bleibt, damit die Rubrik erkennbar ist. */}
          <p className="type-label-xs text-muted-foreground uppercase">
            {t("project.metadata.editors.label")}
            {labelSuffix}
          </p>
          {value.length === 0 && (
            <p className="type-body-sm text-muted-foreground">
              {t("project.metadata.editors.none")}
            </p>
          )}
        </>
      ) : (
        <PersonCombobox
          id={inputId}
          label={t("project.metadata.editors.label")}
          labelSuffix={labelSuffix}
          role="EDITOR"
          excludedIds={excludedIds}
          placeholder={t("project.metadata.editors.placeholder")}
          /* value bleibt null: die gewaehlte Person wandert sofort in die
             Pillenliste darunter, und das Feld ist wieder frei fuer die
             naechste. */
          value={null}
          onChange={(person) => {
            if (person !== null) {
              add(person)
            }
          }}
        />
      )}

      {value.length > 0 && (
        <>
          <span id={listLabelId} className="sr-only">
            {t("project.metadata.editors.chosen")}
          </span>
          <ul
            /* role="list" ausdruecklich: Tailwinds Preflight setzt
               list-style: none, und Safari mit VoiceOver verwirft dann die
               Listensemantik samt Beschriftung (wie bei der TagCombobox). */
            role="list"
            aria-labelledby={listLabelId}
            className="flex flex-wrap gap-2"
          >
            {value.map((person) => (
              <li key={person.id}>
                {/* h-auto und overflow-visible heben zwei Grundklassen des
                    Badge auf. Ohne sie schneidet die Pille den Fokusring der
                    Entfernen-Schaltflaeche weg und beschneidet ihre
                    Trefferflaeche (SC 2.4.7, SC 2.5.8; Befund aus KAN-75). */}
                <Tag className="h-auto items-center gap-1 overflow-visible py-0.5 pr-0.5">
                  <span>{fullNameOf(person)}</span>
                  {!locked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("project.metadata.editors.remove", {
                        name: fullNameOf(person),
                      })}
                      onClick={() => remove(person.id)}
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  )}
                </Tag>
              </li>
            ))}
          </ul>
        </>
      )}

      {readOnlyReason !== undefined && (
        <FieldDescription>{readOnlyReason}</FieldDescription>
      )}
    </div>
  )
}
