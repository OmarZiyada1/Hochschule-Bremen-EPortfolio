import { PlusIcon, XIcon } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type { UserLookupResponse } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
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

/**
 * Die Projektmitglieder des Metadatenformulars (§3.13, §3.13.1, KAN-35):
 * Co-Autor:innen und Mitwirkende, je Zeile eine Person und eine freie
 * Funktionsbezeichnung wie "Frontend".
 *
 * <p><strong>Die Funktionsbezeichnung ist nicht die Systemrolle</strong>
 * (§3.3). {@code members} tragen keine Rolle aus §2.1; wer hier "Redaktion"
 * eintraegt, hat damit keine Rechte.
 *
 * <p><strong>Beliebig viele, und jede Aufnahme haengt an.</strong> Die
 * Liste oben zeigt alle bereits aufgenommenen Personen, darunter steht die
 * Zeile fuer die naechste. Wer schon in der Liste steht, taucht in der
 * Vorschlagsliste nicht mehr auf, ebenso wenig die Autor:in: sie steht in
 * {@code Project.authorId} und ist keine {@code ProjectMember}-Zeile
 * (§3.13.1).
 *
 * <p><strong>Beide Angaben sind Pflicht, und das steht sichtbar da.</strong>
 * Ohne {@code userId} gibt es keinen Eintrag, und {@code projectRole} fuehrt
 * §3.13 als {@code not null}; {@code MemberRequest} setzt es mit
 * {@code @NotBlank} durch. Vorher liess sich das Rollenfeld leicht
 * uebersehen, weil nur ein Plus-Symbol daneben stand und nichts sagte, was
 * ihm fehlt (Rueckmeldung zu KAN-35). Jetzt tragen beide Felder die
 * Pflichtkennzeichnung, der Knopf ist beschriftet, und solange etwas fehlt,
 * nennt eine Meldung darunter genau das.
 *
 * <p>Pflegbar nur in {@code DRAFT} und {@code REVISION} (§3.13.1), dieselbe
 * Schranke wie fuer jede andere Inhaltsaenderung. Das Formular reicht dafuer
 * sein {@code disabled} durch. Innerhalb dieser Schranke duerfen auch
 * bestehende Mitglieder weitere aufnehmen: Gruppenarbeiten organisieren sich
 * nicht ueber eine einzelne privilegierte Person, und bei Abwesenheit der
 * Autor:in kaeme die Gruppe sonst nicht weiter.
 */
export function ProjectMembersField({
  value,
  onChange,
  authorId,
  disabled = false,
}: {
  value: MemberValue[]
  onChange: (next: MemberValue[]) => void
  /** Die Autor:in, sie wird aus der Vorschlagsliste ausgeblendet (§3.13.1). */
  authorId?: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const roleInputId = `${fieldId}-role`
  const roleHintId = `${fieldId}-role-hint`
  const listLabelId = `${fieldId}-chosen`
  const statusId = `${fieldId}-status`

  const [pending, setPending] = useState<UserLookupResponse | null>(null)
  const [pendingRole, setPendingRole] = useState("")

  const roleGiven = pendingRole.trim() !== ""
  const complete = pending !== null && roleGiven

  const excludedIds = useMemo(
    () => [
      ...value.map((member) => member.id),
      ...(authorId === undefined ? [] : [authorId]),
      ...(pending === null ? [] : [pending.id]),
    ],
    [value, authorId, pending]
  )

  /** Pflichtkennzeichnung: Symbol und Text, nicht Farbe allein (SC 1.4.1). */
  const required = (
    <span className="inline-flex items-center">
      <span aria-hidden="true" className="text-muted-foreground">
        *
      </span>
      <span className="sr-only"> {t("project.metadata.members.required")}</span>
    </span>
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
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <>
          <span id={listLabelId} className="sr-only">
            {t("project.metadata.members.chosen")}
          </span>
          <ItemGroup aria-labelledby={listLabelId} className="gap-2">
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
        </>
      )}

      {/* Die Zeile fuer die naechste Person: Mitglied, Rolle, Hinzufuegen. */}
      <div className="flex flex-col gap-3 rounded-card border p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <PersonCombobox
            className="flex-1"
            label={t("project.metadata.members.person")}
            labelSuffix={required}
            excludedIds={excludedIds}
            placeholder={t("project.metadata.members.personPlaceholder")}
            disabled={disabled}
            onSelect={setPending}
          />

          <Field className="flex-1 gap-2">
            <FieldLabel htmlFor={roleInputId}>
              {t("project.metadata.members.role")}
              {required}
            </FieldLabel>
            <Input
              id={roleInputId}
              value={pendingRole}
              disabled={disabled}
              placeholder={t("project.metadata.members.rolePlaceholder")}
              aria-describedby={roleHintId}
              onChange={(event) => setPendingRole(event.target.value)}
            />
            {/* Steht dauerhaft da, nicht erst im Fehlerfall: das Feld wurde
                sonst schlicht uebersehen. */}
            <FieldDescription id={roleHintId}>
              {t("project.metadata.members.roleHint")}
            </FieldDescription>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Beschriftet statt nur als Symbol: der Knopf schliesst einen
              zweischrittigen Vorgang ab, und ein blosses Plus sagt nicht,
              was es hinzufuegt. */}
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || !complete}
            aria-describedby={statusId}
            onClick={add}
          >
            <PlusIcon aria-hidden="true" />
            {t("project.metadata.members.addButton")}
          </Button>

          {/*
           * Dauerhaft im Baum, nur der Text wechselt: eine Live-Region, die
           * zusammen mit ihrem Inhalt entsteht, sagt bei einigen
           * Screenreadern nichts (SC 4.1.3). Sie benennt genau das, was dem
           * Knopf noch fehlt (SC 3.3.1).
           */}
          <p
            id={statusId}
            aria-live="polite"
            className="type-body-sm text-muted-foreground"
          >
            {disabled
              ? ""
              : pending === null
                ? t("project.metadata.members.needsPerson")
                : !roleGiven
                  ? t("project.metadata.members.needsRole", {
                      name: fullNameOf(pending),
                    })
                  : t("project.metadata.members.ready", {
                      name: fullNameOf(pending),
                    })}
          </p>
        </div>
      </div>
    </div>
  )
}
