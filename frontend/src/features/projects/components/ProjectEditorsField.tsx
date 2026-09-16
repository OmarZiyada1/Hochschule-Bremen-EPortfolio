import { XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useId, useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { Role } from "@/api/types"
import { Tag } from "@/components/common/Tag"
import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { PersonCombobox } from "@/features/projects/components/PersonCombobox"
import type { PersonValue } from "@/features/projects/ProjectMetadataForm.schema"
import { fullNameOf } from "@/lib/name"

/* Modulweit und nicht als Literal im Default: ein frisches [] je Render wuerde
   die Abhaengigkeit von excludedIds bei jedem Durchlauf wechseln lassen. */
const NO_IDS: readonly string[] = []

/**
 * Die zuweisbaren Rollen (§3.3, §5 Fussnoten 3 und 5 seit Contract v89,
 * KAN-87). Ein Admin-Konto steht zur Wahl, weil es dieselben redaktionellen
 * Entscheidungen trifft; die Zuweisung gibt ihm dabei kein Recht, sie holt
 * das Projekt allein in seine Liste „Meine Reviews".
 *
 * <p>Modulweit aus demselben Grund wie {@link NO_IDS}: die Liste steht im
 * Query-Key der Auswahlliste.
 */
const ASSIGNABLE_ROLES: readonly Role[] = ["EDITOR", "ADMIN"]

/**
 * Die Redaktionszuweisung des Metadatenformulars (§3.3, §5 Fussnote 3,
 * KAN-35): ein Suchfeld ueber
 * {@code GET /api/users/lookup?role=EDITOR&role=ADMIN}, darunter die
 * gewaehlten Personen als Pillen.
 *
 * <p><strong>Zur Wahl stehen beide entscheidungsberechtigten Rollen</strong>
 * (§5 Fussnoten 3 und 5 seit Contract v89, KAN-87). Bis v88 fragte das Feld
 * fest mit {@code role=EDITOR} ab, und ein Admin-Konto liess sich deshalb
 * ueber die Oberflaeche nicht zuweisen, obwohl der Server es annahm. Damit
 * blieb „Meine Reviews" fuer eine allein administrierende Person dauerhaft
 * leer. Die Zuweisung aendert an den Rechten eines Admins nichts, sie holt
 * das Projekt in seine Arbeitsliste.
 *
 * <p><strong>Mehrfachauswahl, obwohl das Template ein Feld zeigt.</strong>
 * §3.3 fuehrt {@code editors} als N:M, §6.1 {@code editorIds} als Liste;
 * das Template zeigt den einfachsten Fall. Entschieden in der
 * Klaerungsrunde zu KAN-35.
 *
 * <p><strong>Die Projektseite steht nicht zur Auswahl</strong> (§5, Fussnote 3
 * seit Contract v61, KAN-77): weder die eigene Person noch die Autor:in noch
 * die im Formular eingetragenen Projektmitglieder. Wer an einer Arbeit
 * mitgeschrieben hat, beurteilt sie nicht; der Server weist einen solchen
 * Schreibvorgang mit 400 {@code VALIDATION_FAILED} ab. Ein Vorschlag, der beim
 * Speichern in einen Fehler laeuft, gehoert nicht in die Liste. Die Oberflaeche
 * ersetzt die Serverpruefung damit nicht, sie nimmt ihr die Ueberraschung.
 *
 * <p><strong>Aenderbar in {@code DRAFT} und {@code REVISION}</strong>
 * (§5, Fussnote 3 seit Contract v62), also solange die Autor:in an ihrem
 * Projekt arbeitet. Danach fuehrt der Weg ueber die Administration, und das
 * Feld steht schreibgeschuetzt da und nennt den Grund. Der Server prueft das ohnehin;
 * die Oberflaeche spiegelt die Regel, sie ersetzt sie nicht.
 */
export function ProjectEditorsField({
  value,
  onChange,
  id,
  currentUserId,
  authorId,
  memberIds = NO_IDS,
  disabled = false,
  invalid = false,
  describedBy,
  readOnlyReason,
  labelSuffix,
}: {
  value: PersonValue[]
  onChange: (next: PersonValue[]) => void
  /**
   * ID des Suchfeldes, also des Bedienelements, das den Fokus bekommt.
   * Der Stepper braucht sie: schlaegt das Absenden fehl, springt der Fokus
   * in das erste beanstandete Feld des aufgeklappten Schrittes, und dafuer
   * muss die aufrufende Stelle das Feld benennen koennen (KAN-103). Ohne
   * Angabe wie bisher eine erzeugte, wie in der {@code TagCombobox}.
   */
  id?: string
  /** Eigenes Konto, wird aus der Vorschlagsliste ausgeblendet. */
  currentUserId?: string
  /** Die Autor:in; sie gehoert zur Projektseite und steht nicht zur Wahl. */
  authorId?: string
  /** Die im Formular eingetragenen Projektmitglieder, aus demselben Grund. */
  memberIds?: readonly string[]
  disabled?: boolean
  /** Reicht {@code aria-invalid} und die Fehler-ID an das Suchfeld durch. */
  invalid?: boolean
  describedBy?: string
  /**
   * Warum das Feld nicht mehr aenderbar ist. Gesetzt heisst zugleich: keine
   * Suche, nur die Anzeige der bereits zugewiesenen Redaktion.
   */
  readOnlyReason?: string
  /** Kennzeichnung "erforderlich zum Einreichen" hinter der Beschriftung. */
  labelSuffix?: ReactNode
}) {
  const { t } = useTranslation()
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listLabelId = `${inputId}-chosen`

  const locked = disabled || readOnlyReason !== undefined

  const excludedIds = useMemo(
    () => [
      ...value.map((person) => person.id),
      ...(currentUserId === undefined ? [] : [currentUserId]),
      ...(authorId === undefined ? [] : [authorId]),
      ...memberIds,
    ],
    [value, currentUserId, authorId, memberIds]
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
          role={ASSIGNABLE_ROLES}
          excludedIds={excludedIds}
          invalid={invalid}
          describedBy={describedBy}
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
