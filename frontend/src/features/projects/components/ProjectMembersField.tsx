import { PlusIcon, Trash2Icon } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type { UserLookupResponse } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { PersonCombobox } from "@/features/projects/components/PersonCombobox"
import {
  PROJECT_ROLE_MAX_LENGTH,
  type MemberValue,
} from "@/features/projects/ProjectMetadataForm.schema"
import { fullNameOf } from "@/lib/name"
import { InfoHint } from "@/components/common/InfoHint"

/* Modulweit und nicht als Literal im Default: ein frisches [] je Render wuerde
   die Abhaengigkeit von excludedIds bei jedem Durchlauf wechseln lassen. */
const NO_IDS: readonly string[] = []

/**
 * Die Projektmitglieder des Metadatenformulars (§3.13, §3.13.1):
 * Co-Autor:innen und Mitwirkende, je Eintrag eine Person und eine freie
 * Funktionsbezeichnung wie "Frontend".
 *
 * <p><strong>Gestapelt, nicht zweispaltig.</strong> Oben steht eine einzige
 * Eingabezeile aus Personenauswahl, Bezeichnung und Plus-Knopf, darunter die
 * aufgenommenen Mitglieder ueber die volle Breite. Zwei Spalten drueckten
 * beide Eingaben auf eine halbe Breite, obwohl die Namenssuche die breiteste
 * Eingabe des Formulars ist, und legten die Liste neben statt unter den
 * Knopf, der sie fuellt. Auf schmalen Breiten steht die Zeile untereinander.
 *
 * <p><strong>Die Zeile richtet sich unten aus.</strong> Die Beschriftungen
 * stehen ueber den Feldern, also liegen die Oberkanten verschieden hoch; auf
 * einer Hoehe liegen allein die Unterkanten, und dort passen Eingabe
 * ({@code h-11}) und Knopf ({@code size-11}) genau zusammen.
 *
 * <p><strong>Der Knopf zeigt nur das Zeichen.</strong> Sein zugaenglicher
 * Name steht als {@code sr-only} daneben, wie im Anlegefeld der Stammdaten
 * ({@code NameCreateForm}). Aus demselben Grund wie dort scheidet
 * {@code input-group} aus: es legte den Knopf in das Feld statt daneben.
 *
 * <p><strong>Eine Ueberschrift braucht das Feld keine, eine Beschriftung
 * schon</strong> (KAN-103). "Mitglied" und "Rolle" benennen die beiden
 * Eingaben, aber nicht den Block als ganzen; im Stepper steht er zwischen
 * der Redaktion und dem naechsten Schritt und braucht einen eigenen Namen.
 * Der steht als {@code FieldTitle}, nicht als {@code h3}: eine zweite
 * Ueberschriftenebene in einem Formular gliedert nichts, was die
 * Beschriftungen nicht schon gliedern (Entscheidung zu KAN-103).
 *
 * <p><strong>Kein Stern mehr an "Mitglied"</strong> (KAN-103). Er stand
 * hier fuer etwas anderes als in der Klassifikation: dort heisst er
 * "erforderlich zum Einreichen" (§3.3), hier hiess er "ohne Person kein
 * Eintrag". Dasselbe Zeichen fuer zwei Regeln im selben Formular ist eine
 * Regel zu viel, zumal Mitglieder weder zum Speichern noch zum Einreichen
 * Pflicht sind ({@code REQUIRED_FOR_SUBMIT} fuehrt sie nicht). Was der
 * Stern sagen sollte, sagt jetzt der Satz unter der Eingabezeile, und der
 * gesperrte Knopf zeigt es ohnehin.
 *
 * <p><strong>Die gewaehlte Person bleibt im Feld stehen</strong>, bis sie
 * aufgenommen ist. Vorher wanderte sie sofort als Pille nach unten, und der
 * Blick sprang mit; jetzt tut sich zwischen Auswahl und Aufnahme nichts,
 * was man verfolgen muesste.
 *
 * <p><strong>Pflicht ist allein die Person</strong>, und nur sie traegt
 * darum die Pflichtkennzeichnung. Ohne {@code userId} gibt es keinen
 * Eintrag; die Funktionsbezeichnung dagegen ist seit Contract v65
 * freiwillig, {@code MemberRequest} prueft sie mit {@code @Size(max = 255)}
 * und nicht mit {@code @NotBlank}. Der Knopf bleibt gesperrt, solange keine
 * Person feststeht, und laesst sich mit leerer Bezeichnung druecken.
 *
 * <p><strong>In der Liste ist die Bezeichnung nur noch Text</strong>, hinter
 * dem Namen und durch " · " abgesetzt, in derselben Schreibweise wie auf der
 * Projektseite ({@code ProjectMetaSidebar}). Dieselbe Angabe soll nicht an
 * zwei Stellen in zwei Formen erscheinen, einmal als Fliesstext und einmal
 * als Eingabefeld. Eine Korrektur laeuft dafuer ueber Entfernen und erneutes
 * Aufnehmen: das ist ein Griff mehr, dafuer gibt es die Bezeichnung genau an
 * einer Stelle einzutippen, naemlich oben in der Eingabezeile.
 *
 * <p><strong>Und dieser Text darf umbrechen.</strong> {@code ItemTitle}
 * bringt {@code line-clamp-1 flex w-fit} mit; in der erzeugten Datei steht
 * {@code .flex} hinter {@code .line-clamp-1}, also gewinnt
 * {@code display:flex}, vom Zuschnitt bleibt allein {@code overflow:hidden}
 * uebrig und eine lange Bezeichnung waere an der Kante abgeschnitten, ohne
 * Auslassungszeichen und ohne Weg, sie noch zu lesen. Deshalb
 * {@code block w-full}: {@code tailwind-merge} loest {@code flex} nach
 * {@code block} und {@code w-fit} nach {@code w-full} auf, und
 * {@code .block} steht ebenfalls hinter {@code .line-clamp-1}. Der Nebeneffekt
 * ist erwuenscht: ohne Flexlayout wirkt das {@code gap-2} der Primitive nicht
 * mehr, und vor dem Trennzeichen steht dasselbe Wortleerzeichen wie auf der
 * Projektseite (Befund des frontend-reviewers).
 *
 * <p><strong>Die Bezeichnung ist schon beim Tippen auf 255 Zeichen
 * begrenzt</strong> ({@code MemberRequest} prueft {@code @Size(max = 255)}).
 * Ein natives {@code maxLength} und keine Pruefung neben dem Schema
 * (Frontend-Regel 12): waere der zu lange Wert erst einmal aufgenommen,
 * liesse er sich in der Liste nicht mehr berichtigen, und die Sammelmeldung
 * am Feld nennte weder das Mitglied noch den Grund.
 *
 * <p><strong>Die Eingabetaste im Rollenfeld nimmt auf</strong>, statt das
 * ganze Formular abzuschicken, sobald eine Person feststeht. Ohne das
 * loeste sie die implizite Absendung aus ("Speichern & weiter zum Editor"),
 * und {@code pending} und {@code pendingRole} gingen als lokaler Zustand
 * dabei verloren: das Mitglied waere weg, ohne je gespeichert zu sein. Ein
 * eigenes {@code <form>} wie im {@code NameCreateForm} scheidet aus,
 * Formulare lassen sich nicht schachteln. Steht keine Person fest, bleibt es
 * bei der Absendung: {@code add()} taete dann ohnehin nichts.
 *
 * <p><strong>Nach dem Aufnehmen geht der Fokus auf die Personensuche
 * zurueck</strong> und die Aufnahme wird angesagt. Der Knopf sperrt sich im
 * selben Zug selbst, der Browser entzoege ihm den Fokus und liesse ihn auf
 * {@code body} fallen; die Personensuche ist ohnehin der naechste Schritt.
 * Angesagt wird ueber eine {@code aria-live}-Zeile (SC 4.1.3), wie die
 * {@code PersonCombobox} es fuer die Trefferzahl tut.
 *
 * <p>Wer schon in der Liste steht, taucht in der Vorschlagsliste nicht mehr
 * auf, ebenso wenig die Autor:in: sie steht in {@code Project.authorId} und
 * ist keine {@code ProjectMember}-Zeile (§3.13.1). Ihre eigene
 * Funktionsbezeichnung traegt {@code authorRole} am Projekt und hat ein
 * eigenes Feld daneben (§3.3 seit Contract v66).
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
  id,
  authorId,
  editorIds = NO_IDS,
  disabled = false,
  invalid = false,
  describedBy,
}: {
  value: MemberValue[]
  onChange: (next: MemberValue[]) => void
  /**
   * ID der Personensuche, also des Bedienelements, das den Fokus bekommt.
   * Der Stepper braucht sie: schlaegt das Absenden fehl, springt der Fokus
   * in das erste beanstandete Feld des aufgeklappten Schrittes, und dafuer
   * muss die aufrufende Stelle das Feld benennen koennen (KAN-103). Ohne
   * Angabe wie bisher eine erzeugte, wie in der {@code TagCombobox}.
   */
  id?: string
  /** Die Autor:in, sie wird aus der Vorschlagsliste ausgeblendet (§3.13.1). */
  authorId?: string
  /** Die zugewiesene Redaktion, aus demselben Grund (§5 Fussnote 3). */
  editorIds?: readonly string[]
  disabled?: boolean
  /** Reicht {@code aria-invalid} und die Fehler-ID an die Personensuche durch. */
  invalid?: boolean
  describedBy?: string
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const personInputId = id ?? `${fieldId}-person`
  const roleInputId = `${fieldId}-role`
  const listLabelId = `${fieldId}-chosen`
  const groupLabelId = `${fieldId}-group`
  const entryHintId = `${fieldId}-entry-hint`

  /*
   * Beides an der Personensuche: der Satz, der sagt, wann ein Eintrag
   * entsteht, und die Fehlermeldung des Feldes. aria-describedby nimmt
   * mehrere IDs, getrennt durch Leerzeichen; nur anbinden, was auch
   * dasteht, sonst zeigt der Verweis ins Leere.
   */
  const personDescribedBy = [entryHintId, describedBy]
    .filter((entry) => entry !== undefined)
    .join(" ")

  const [pending, setPending] = useState<UserLookupResponse | null>(null)
  const [pendingRole, setPendingRole] = useState("")
  /* Was zuletzt geschehen ist, allein fuer die Ansage. Sichtbar steht es
     bereits als neue Zeile in der Liste. */
  const [announcement, setAnnouncement] = useState("")

  /*
   * Nur die Person ist noetig. Die Funktionsbezeichnung ist seit Contract
   * v65 freiwillig; sie hier zu verlangen hiesse, beim Aufnehmen eine
   * Angabe zu erzwingen, die das Datenmodell nicht verlangt.
   */
  const complete = pending !== null

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
    const added: MemberValue = {
      id: pending.id,
      firstName: pending.firstName,
      lastName: pending.lastName,
      projectRole: pendingRole.trim(),
    }
    onChange([...value, added])
    setPending(null)
    setPendingRole("")
    setAnnouncement(
      t("project.metadata.members.added", { name: fullNameOf(added) })
    )
    /*
     * Ueber die ID und nicht ueber ein ref: die PersonCombobox reicht ihr
     * eigenes Eingabefeld nicht nach aussen, nimmt aber eine ID entgegen,
     * und diese ID gehoert ohnehin schon hierher (siehe Klassenkopf). Der
     * Aufruf steht noch vor dem naechsten Rendern, der Knopf ist also
     * gerade noch bedienbar und gibt den Fokus regulaer ab.
     */
    document.getElementById(personInputId)?.focus()
  }

  function remove(userId: string) {
    onChange(value.filter((member) => member.id !== userId))
  }

  return (
    <div
      role="group"
      aria-labelledby={groupLabelId}
      className="flex flex-col gap-4"
    >
      {/* Name des Blocks, nicht der beiden Eingaben darin. Siehe
          Klassenkopf: Beschriftung ja, Ueberschrift nein. */}
      <div className="flex items-center gap-1">
        <FieldTitle id={groupLabelId}>
          {t("project.metadata.members.group")}
        </FieldTitle>
        {/* Was der Block ist und wann ein Eintrag zustande kommt, hinter
            einem „i". Der Text haengt trotzdem am Feld: er ist eine
            Anweisung zur Eingabe und darf nicht allein hinter einem Knopf
            liegen (SC 3.3.2), deshalb steht er zusaetzlich unsichtbar da
            und wird unten ueber aria-describedby verbunden. */}
        <InfoHint
          label={t("project.metadata.members.infoLabel")}
          text={t("project.metadata.members.info")}
          descriptionId={entryHintId}
        />
      </div>

      {/* Oben: Person, Bezeichnung und Knopf in einer Zeile. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2">
        <PersonCombobox
          className="flex-1"
          id={personInputId}
          label={t("project.metadata.members.person")}
          value={pending}
          onChange={setPending}
          excludedIds={excludedIds}
          placeholder={t("project.metadata.members.personPlaceholder")}
          disabled={disabled}
          invalid={invalid}
          describedBy={personDescribedBy}
        />

        <Field className="flex-1">
          <FieldLabel
            htmlFor={roleInputId}
            className="type-label-xs text-muted-foreground uppercase"
          >
            {/* Ohne Pflichtkennzeichnung: die Bezeichnung ist seit Contract
                v65 freiwillig. */}
            {t("project.metadata.members.role")}
          </FieldLabel>
          <Input
            id={roleInputId}
            className="h-11"
            value={pendingRole}
            disabled={disabled}
            maxLength={PROJECT_ROLE_MAX_LENGTH}
            placeholder={t("project.metadata.members.rolePlaceholder")}
            onChange={(event) => setPendingRole(event.target.value)}
            onKeyDown={(event) => {
              /* Aufnehmen statt Absenden, aber nur wenn es etwas aufzunehmen
                 gibt (siehe Klassenkopf). */
              if (event.key !== "Enter" || !complete) {
                return
              }
              event.preventDefault()
              add()
            }}
          />
        </Field>

        {/* Quadratisch und ohne sichtbaren Text; der Name steht sr-only. */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-11 shrink-0"
          disabled={disabled || !complete}
          onClick={add}
        >
          <PlusIcon aria-hidden="true" />
          <span className="sr-only">
            {t("project.metadata.members.addButton")}
          </span>
        </Button>
      </div>

      {/* Darunter: die aufgenommenen Mitglieder ueber die volle Breite. */}
      <div>
        <span id={listLabelId} className="sr-only">
          {t("project.metadata.members.chosen")}
        </span>
        {value.length === 0 ? (
          <p className="type-body-sm text-muted-foreground">
            {t("project.metadata.members.none")}
          </p>
        ) : (
          <ItemGroup aria-labelledby={listLabelId} className="gap-2">
            {value.map((member) => {
              return (
                <Item
                  key={member.id}
                  variant="outline"
                  size="sm"
                  role="listitem"
                >
                  <ItemContent>
                    {/* block w-full statt flex w-fit: siehe Klassenkopf. */}
                    <ItemTitle className="block w-full">
                      {fullNameOf(member)}
                      {member.projectRole && (
                        <span className="type-body-sm font-normal text-muted-foreground">
                          {` · ${member.projectRole}`}
                        </span>
                      )}
                    </ItemTitle>
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
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        )}
      </div>

      {/*
       * Die Aufnahme gehoert angesagt, aber nicht gedruckt: sie steht
       * sichtbar bereits als neue Zeile in der Liste (SC 4.1.3), wie die
       * Trefferzahl der PersonCombobox.
       */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
