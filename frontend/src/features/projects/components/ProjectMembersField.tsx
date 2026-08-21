import { PlusIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type { UserLookupResponse } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { PersonCombobox } from "@/features/projects/components/PersonCombobox"
import type { MemberValue } from "@/features/projects/ProjectMetadataForm.schema"
import { fullNameOf } from "@/lib/name"

/* Modulweit und nicht als Literal im Default: ein frisches [] je Render wuerde
   die Abhaengigkeit von excludedIds bei jedem Durchlauf wechseln lassen. */
const NO_IDS: readonly string[] = []

/**
 * Die Projektmitglieder des Metadatenformulars (§3.13, §3.13.1, KAN-35):
 * Co-Autor:innen und Mitwirkende, je Zeile eine Person und eine freie
 * Funktionsbezeichnung wie "Frontend".
 *
 * <p><strong>Zwei Spalten.</strong> Links die beiden Eingabefelder
 * untereinander, rechts die bereits aufgenommenen Mitglieder, dazwischen
 * der Knopf. So steht das Ergebnis neben der Eingabe und nicht darunter,
 * und die Liste waechst, ohne die Felder wegzuschieben.
 *
 * <p><strong>Die gewaehlte Person bleibt im Feld stehen</strong>, bis sie
 * aufgenommen ist. Vorher wanderte sie sofort als Pille nach unten, und der
 * Blick sprang mit; jetzt tut sich zwischen Auswahl und Aufnahme nichts,
 * was man verfolgen muesste.
 *
 * <p><strong>Beide Angaben sind Pflicht, und das sagen die Sterne.</strong>
 * Ohne {@code userId} gibt es keinen Eintrag, und {@code projectRole} fuehrt
 * §3.13 als {@code not null}; {@code MemberRequest} setzt es mit
 * {@code @NotBlank} durch. Der Knopf bleibt gesperrt, bis beides steht.
 * Erklaerende Saetze daneben braucht es dafuer nicht: die Platzhalter in
 * den Feldern sagen, was hineingehoert.
 *
 * <p>Wer schon in der Liste steht, taucht in der Vorschlagsliste nicht mehr
 * auf, ebenso wenig die Autor:in: sie steht in {@code Project.authorId} und
 * ist keine {@code ProjectMember}-Zeile (§3.13.1).
 *
 * <p><strong>Und ebenso wenig die zugewiesene Redaktion</strong> (§5, Fussnote 3
 * seit Contract v61, KAN-77). Zugewiesene Redaktion und Projektseite
 * schliessen einander aus, und zwar in beide Richtungen: der Server antwortet
 * mit 400 {@code VALIDATION_FAILED} am Feld {@code members}, sobald ein
 * Schreibvorgang ein Redaktionskonto neu zum Mitglied macht. Das Gegenstueck
 * steht im {@code ProjectEditorsField}. Der Preis waere hier besonders hoch:
 * der Fehler verwuerfe den gesamten PUT, also auch Titel, Tags und
 * Klassifikation.
 *
 * <p>Pflegbar nur in {@code DRAFT} und {@code REVISION} (§3.13.1), dieselbe
 * Schranke wie fuer jede andere Inhaltsaenderung. Innerhalb dieser Schranke
 * duerfen auch bestehende Mitglieder weitere aufnehmen: Gruppenarbeiten
 * organisieren sich nicht ueber eine einzelne privilegierte Person.
 */
export function ProjectMembersField({
  value,
  onChange,
  authorId,
  editorIds = NO_IDS,
  disabled = false,
  invalid = false,
  describedBy,
  labelSuffix,
}: {
  value: MemberValue[]
  onChange: (next: MemberValue[]) => void
  /** Die Autor:in, sie wird aus der Vorschlagsliste ausgeblendet (§3.13.1). */
  authorId?: string
  /** Die zugewiesene Redaktion, aus demselben Grund (§5 Fussnote 3). */
  editorIds?: readonly string[]
  disabled?: boolean
  /** Reicht {@code aria-invalid} und die Fehler-ID an die Personensuche durch. */
  invalid?: boolean
  describedBy?: string
  /** Pflichtkennzeichnung hinter beiden Beschriftungen. */
  labelSuffix?: ReactNode
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const roleInputId = `${fieldId}-role`
  const listLabelId = `${fieldId}-chosen`

  const [pending, setPending] = useState<UserLookupResponse | null>(null)
  const [pendingRole, setPendingRole] = useState("")

  const complete = pending !== null && pendingRole.trim() !== ""

  const excludedIds = useMemo(
    () => [
      ...value.map((member) => member.id),
      ...(authorId === undefined ? [] : [authorId]),
      ...editorIds,
    ],
    [value, authorId, editorIds]
  )

  function add() {
    if (!complete) {
      return
    }
    /* Anhaengen, nie ersetzen: die Liste traegt beliebig viele Mitglieder
       (§3.13, 1:N). */
    onChange([
      ...value,
      {
        id: pending.id,
        firstName: pending.firstName,
        lastName: pending.lastName,
        projectRole: pendingRole.trim(),
      },
    ])
    setPending(null)
    setPendingRole("")
  }

  function remove(userId: string) {
    onChange(value.filter((member) => member.id !== userId))
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {/* Links: die beiden Felder untereinander. */}
      <div className="flex flex-1 flex-col gap-3">
        <PersonCombobox
          label={t("project.metadata.members.person")}
          labelSuffix={labelSuffix}
          value={pending}
          onChange={setPending}
          excludedIds={excludedIds}
          placeholder={t("project.metadata.members.personPlaceholder")}
          disabled={disabled}
          invalid={invalid}
          describedBy={describedBy}
        />

        <Field className="gap-2">
          <FieldLabel
            htmlFor={roleInputId}
            className="type-label-xs text-muted-foreground uppercase"
          >
            {t("project.metadata.members.role")}
            {labelSuffix}
          </FieldLabel>
          <Input
            id={roleInputId}
            className="h-11"
            value={pendingRole}
            disabled={disabled}
            placeholder={t("project.metadata.members.rolePlaceholder")}
            onChange={(event) => setPendingRole(event.target.value)}
          />
        </Field>
      </div>

      {/* Dazwischen: der Knopf, freigegeben sobald beides steht. */}
      <Button
        type="button"
        variant="secondary"
        className="md:mt-7 md:self-start"
        disabled={disabled || !complete}
        onClick={add}
      >
        <PlusIcon aria-hidden="true" />
        {t("project.metadata.members.addButton")}
      </Button>

      {/* Rechts: die aufgenommenen Mitglieder. */}
      <div className="flex-1">
        <span id={listLabelId} className="sr-only">
          {t("project.metadata.members.chosen")}
        </span>
        {value.length === 0 ? (
          <p className="type-body-sm text-muted-foreground md:mt-7">
            {t("project.metadata.members.none")}
          </p>
        ) : (
          <ItemGroup aria-labelledby={listLabelId} className="gap-2 md:mt-7">
            {value.map((member) => (
              <Item key={member.id} variant="outline" size="sm" role="listitem">
                <ItemContent>
                  <ItemTitle>{fullNameOf(member)}</ItemTitle>
                  <ItemDescription>{member.projectRole}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    aria-label={t("project.metadata.members.remove", {
                      name: fullNameOf(member),
                    })}
                    onClick={() => remove(member.id)}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </div>
    </div>
  )
}
