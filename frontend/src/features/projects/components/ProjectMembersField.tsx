import { PlusIcon, XIcon } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type { UserLookupResponse } from "@/api/types"
import { Tag } from "@/components/common/Tag"
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

/**
 * Die Projektmitglieder des Metadatenformulars (§3.13, §3.13.1, KAN-35):
 * Co-Autor:innen und Mitwirkende, je Zeile eine Person und eine freie
 * Funktionsbezeichnung wie "Frontend".
 *
 * <p><strong>Die Funktionsbezeichnung ist nicht die Systemrolle</strong>
 * (§3.3). {@code members} tragen keine Rolle aus §2.1; wer hier "Redaktion"
 * eintraegt, hat damit keine Rechte. Deshalb steht die Rubrik im Formular
 * auch getrennt von der Redaktionszuweisung und nicht daneben.
 *
 * <p><strong>Aufnehmen laeuft in zwei Schritten</strong>, wie im Template:
 * Person suchen, Bezeichnung tippen, Plus. <strong>Beides ist Pflicht.</strong>
 * Ohne {@code userId} gibt es keinen Eintrag, und {@code projectRole} fuehrt
 * §3.13 als {@code not null}; {@code MemberRequest} setzt es mit
 * {@code @NotBlank} durch. Der Plus-Knopf bleibt deshalb gesperrt, bis beide
 * Angaben stehen, und nennt den fehlenden Teil ueber seinen zugaenglichen
 * Namen, statt den Fehler dem Server zu ueberlassen: dessen Feldname
 * {@code members[0].projectRole} liesse sich keiner Zeile zuordnen.
 *
 * <p><strong>Das Suchfeld bleibt stehen, auch wenn eine Person gewaehlt
 * ist.</strong> Die gewaehlte Person erscheint als Pille darunter. Wuerde
 * das Feld gegen einen Text ausgetauscht, stuende wer mit der Tastatur
 * waehlt danach auf {@code document.body} und finge am Seitenanfang von
 * vorn an; derselbe Befund wie an der TagCombobox in KAN-75 (hier gemeldet
 * vom frontend-reviewer).
 *
 * <p>Die aufgenommenen Mitglieder stehen als {@code Item} aus der Registry
 * und nicht als selbst gebaute Zeile: Name, Bezeichnung und Aktion sind
 * genau {@code ItemTitle}, {@code ItemDescription} und {@code ItemActions}
 * (Skill frontend-shadcn, Abschnitt 1).
 *
 * <p>Die Autor:in gehoert nicht in die Liste: sie steht in
 * {@code Project.authorId} und ist keine {@code ProjectMember}-Zeile
 * (§3.13.1). Sie wird deshalb aus der Vorschlagsliste ausgeblendet.
 *
 * <p>Pflegbar nur in {@code DRAFT} und {@code REVISION} (§3.13.1), dieselbe
 * Schranke wie fuer jede andere Inhaltsaenderung. Das Formular reicht dafuer
 * sein {@code disabled} durch.
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
  const roleInputId = useId()
  const listLabelId = `${roleInputId}-chosen`

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

  function add() {
    if (!complete) {
      return
    }
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

      {/* Die Zeile zum Aufnehmen, wie im Template: Name, Rolle, Plus. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <PersonCombobox
          className="flex-1"
          label={t("project.metadata.members.person")}
          excludedIds={excludedIds}
          placeholder={t("project.metadata.members.personPlaceholder")}
          disabled={disabled}
          onSelect={setPending}
        />

        <Field className="flex-1 gap-2">
          <FieldLabel htmlFor={roleInputId}>
            {t("project.metadata.members.role")}
          </FieldLabel>
          <Input
            id={roleInputId}
            value={pendingRole}
            disabled={disabled}
            placeholder={t("project.metadata.members.rolePlaceholder")}
            onChange={(event) => setPendingRole(event.target.value)}
          />
        </Field>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={disabled || !complete}
          aria-label={
            pending === null
              ? t("project.metadata.members.addNeedsPerson")
              : !roleGiven
                ? t("project.metadata.members.addNeedsRole", {
                    name: fullNameOf(pending),
                  })
                : t("project.metadata.members.add", {
                    name: fullNameOf(pending),
                  })
          }
          onClick={add}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
      </div>

      {/*
       * Dauerhaft im Baum, nur der Text wechselt: eine Live-Region, die
       * zusammen mit ihrem Inhalt entsteht, sagt bei einigen Screenreadern
       * nichts (SC 4.1.3, Befund des frontend-reviewers).
       */}
      <p aria-live="polite" className="type-body-sm text-muted-foreground">
        {pending !== null && !roleGiven
          ? t("project.metadata.members.roleRequired")
          : ""}
      </p>

      {pending !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-label-xs text-muted-foreground uppercase">
            {t("project.metadata.members.pending")}
          </span>
          <Tag className="h-auto items-center gap-1 overflow-visible py-0.5 pr-0.5">
            <span>{fullNameOf(pending)}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              aria-label={t("project.metadata.members.clearPerson", {
                name: fullNameOf(pending),
              })}
              onClick={() => setPending(null)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </Tag>
        </div>
      )}
    </div>
  )
}
