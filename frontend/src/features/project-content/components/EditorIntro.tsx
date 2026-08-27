import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { ProjectDetailResponse } from "@/api/types"
import { CharacterCounter } from "@/components/common/CharacterCounter"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { CoverImageField } from "@/features/projects/components/CoverImageField"
import {
  TITLE_MAX_LENGTH,
  projectIntroSchema,
  toProjectIntroValues,
  type ProjectIntroValues,
} from "@/features/projects/ProjectMetadataForm.schema"
import { useUploadCoverImage } from "@/features/projects/hooks/useProjectMetadataMutations"

/**
 * Die Kopfpartie ueber der Schreibflaeche: Titelbild, Projekttitel und
 * Abstract, alle drei an Ort und Stelle aenderbar (KAN-36).
 *
 * <p><strong>Bewusst neben dem Template.</strong> Der Figma-Frame
 * {@code Template / Studierende · Editor} zeichnet oben allein den Titel,
 * und zwar als reine Anzeige. Titelbild und Abstract dort ebenfalls zu
 * fuehren, ist eine Nutzerentscheidung: beide erscheinen auf jeder Kachel
 * und in jeder Liste, und sie erst auf der Metadatenseite einzutragen
 * hiess, den Beitrag zu verlassen, um sein Aussehen zu bestimmen.
 *
 * <p><strong>Was hier steht, sind Metadaten und kein Inhalt</strong>
 * (§6.1): sie gehen ueber {@code PUT /api/projects/{id}} hinaus, die
 * Bloecke ueber {@code PUT /api/projects/{id}/blocks}. Zusammengefasst
 * wird das nicht. Weil aber beide Wege dieselbe {@code Project.version}
 * erhoehen (§6.4), fuehrt sie <em>ein</em> Speichertakt nacheinander;
 * diese Komponente sendet selbst nichts, sie meldet nur ihren Stand nach
 * oben (siehe {@code onChange} und {@code onRegisterRead}).
 *
 * <p><strong>Geschrieben wird nur, was hier auch getippt wurde</strong>
 * (siehe {@code touchedRef}). Der Unterschied zum Serverstand allein
 * genuegt <em>nicht</em> als Grund: ein Formular haelt seinen Stand bis
 * zum Abbau, und wenn waehrenddessen jemand anders den Titel aendert,
 * waere jeder Unterschied ein Grund, die fremde Aenderung
 * zurueckzuschreiben. Genau dieser Weg stand nach dem Neuladen im
 * Konfliktdialog offen: die Version ist danach wieder gueltig, ein
 * unberuehrtes Feld haette die fremde Arbeit ohne 409 und ohne Meldung
 * ueberschrieben (§6.4). Ein unberuehrtes Feld uebernimmt deshalb jeden
 * neuen Serverstand, statt gegen ihn anzuschreiben; wer ausdruecklich den
 * Serverstand laedt, bekommt die ganze Kopfpartie neu, dafuer sorgt der
 * {@code key} an der Verwendungsstelle ({@code EditorPage}).
 *
 * <p><strong>Der Projekttitel bleibt die einzige {@code h1} der Seite</strong>
 * (§3.3, §2.5). Beschreibbar ist ein Textfeld mit verbundenem Label; die
 * Gliederung traegt daneben eine {@code sr-only}-Ueberschrift mit dem
 * aktuellen Titel. Ein {@code h1}, das ein Eingabefeld umschliesst, haette
 * keinen zugaenglichen Namen: der Wert eines Feldes ist kein Textinhalt
 * der Ueberschrift. Ohne Schreibrecht steht der Titel als sichtbares
 * {@code h1} da, dann braucht es die verborgene Fassung nicht.
 *
 * <p><strong>Ueber dem Abstract steht seine Beschriftung sichtbar</strong>
 * und in Ueberschriftengroesse. Sie ist das {@code label} des Feldes und
 * keine eigene Ueberschrift daneben: ein Feld braucht einen zugaenglichen
 * Namen, und zwei Elemente fuer dieselbe Aufgabe liefen beim naechsten
 * Umbau auseinander.
 *
 * <p><strong>Zwei Felder und trotzdem ein Schema.</strong> Geprueft wird
 * mit {@code projectIntroSchema}, einem Ausschnitt des einen
 * Metadaten-Schemas (Frontend-Regel 12).
 */
export function EditorIntro({
  project,
  editable,
  onChange,
  onRegisterRead,
}: {
  project: ProjectDetailResponse
  /** Ob die Metadaten geaendert werden duerfen (§4.1, §6.1). */
  editable: boolean
  /**
   * Meldet, dass sich etwas geaendert hat. Wann daraus ein Request wird,
   * entscheidet der Speichertakt der Seite und nicht diese Komponente.
   */
  onChange: () => void
  /**
   * Reicht den Lesezugriff auf den aktuellen Stand nach oben.
   *
   * <p>Der Takt liest damit im Augenblick des Sendens und nicht aus einer
   * Kopie, die beim letzten Rendern entstanden ist. {@code null} heisst:
   * jetzt nicht senden, weil hier nichts getippt wurde oder weil die
   * Eingaben das Schema verletzen; im zweiten Fall steht der Grund
   * sichtbar darunter.
   */
  onRegisterRead: (read: () => ProjectIntroValues | null) => void
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const upload = useUploadCoverImage(project.id)

  /*
   * Welches der beiden Felder gerade den Fokus hat. Der Zeichenzaehler ist
   * nur dort sichtbar: dauerhaft eingeblendet stuende unter dem Titel eine
   * Zahl, die beim Lesen des Beitrags niemand braucht.
   */
  const [focused, setFocused] = useState<"title" | "summary" | null>(null)

  const form = useForm<ProjectIntroValues>({
    resolver: zodResolver(projectIntroSchema),
    defaultValues: toProjectIntroValues(project),
    /*
     * Das einzige Formular des Repositorys mit einem eigenen mode, und der
     * Grund ist, dass es kein Absenden gibt: hier wird getippt und im Takt
     * gespeichert. Mit dem Standard "onSubmit" liefe die Pruefung nie und
     * ein leerer Titel ginge ungeprueft an den Server.
     */
    mode: "onChange",
  })

  /*
   * Abonniert die Felder, damit diese Komponente bei jeder Aenderung neu
   * rendert; der Rueckgabewert wird nicht gebraucht, gelesen wird gleich
   * ueber getValues. useWatch und nicht form.watch: vertraeglich mit dem
   * React Compiler (Lint react-hooks/incompatible-library).
   */
  useWatch({ control: form.control })

  const values = form.getValues()
  const valid = form.formState.isValid
  /*
   * Abdruecke statt Objektvergleiche: an ihnen laesst sich eine echte
   * Aenderung von einem blossen Neurendern unterscheiden. Ohne das meldete
   * jede Zustandsaenderung der Seite (etwa der wechselnde Speicherzustand)
   * eine Aenderung nach oben, und der Takt liefe endlos, ohne je etwas zu
   * senden.
   */
  const snapshot = JSON.stringify(values)
  const serverSnapshot = JSON.stringify(toProjectIntroValues(project))

  /*
   * Ob hier seit dem letzten bestaetigten Gleichstand mit dem Server
   * getippt wurde.
   *
   * <p><strong>Und ausdruecklich nicht {@code formState.isDirty}.</strong>
   * Der misst gegen die Werte beim Montieren und hat zwei Luecken, die
   * beide Eingaben verschlucken: wer eine Aenderung waehrend eines
   * laufenden Requests zuruecknimmt, steht wieder auf dem Ausgangswert und
   * gilt als unveraendert, obwohl der Server gerade die andere Fassung
   * bekommt; und ein Randleerzeichen macht das Formular dauerhaft
   * „veraendert", weil gespeichert der getrimmte Wert wird. Dieses Merkmal
   * wird deshalb an der Eingabe gesetzt und nur dort geloescht, wo ein
   * <em>neuer</em> Serverstand eintrifft, der den hier stehenden Werten
   * entspricht (Befunde des Frontend-Reviews).
   */
  const touchedRef = useRef(false)

  const currentRef = useRef<ProjectIntroValues | null>(null)
  const lastRef = useRef<string | null>(null)
  const lastServerRef = useRef(serverSnapshot)

  useEffect(() => {
    /*
     * Ueber das Schema gelesen und nicht roh: es trimmt den Titel, genau
     * wie beim Speichern ueber das Metadatenformular. Ohne das schriebe
     * der Editor "Mein Titel   " und das Formular "Mein Titel".
     */
    const parsed = projectIntroSchema.safeParse(
      JSON.parse(snapshot) as ProjectIntroValues
    )
    currentRef.current =
      touchedRef.current && parsed.success ? parsed.data : null

    if (lastRef.current === null) {
      /* Der erste Durchlauf ist der geladene Stand und keine Aenderung. */
      lastRef.current = snapshot
      return
    }
    if (lastRef.current === snapshot) {
      return
    }
    lastRef.current = snapshot
    onChange()
  }, [snapshot, onChange])

  /*
   * Ein neuer Serverstand. Ist hier nichts Eigenes offen, wird er
   * uebernommen; sonst bleibt die eigene Eingabe stehen, und ob sie
   * geschrieben werden darf, entscheidet die Versionspruefung (§6.4).
   * Entspricht der neue Stand genau dem, was hier steht, war es die eigene
   * Speicherung: dann ist nichts mehr offen.
   */
  useEffect(() => {
    if (lastServerRef.current === serverSnapshot) {
      return
    }
    lastServerRef.current = serverSnapshot

    const parsed = projectIntroSchema.safeParse(form.getValues())
    if (parsed.success && JSON.stringify(parsed.data) === serverSnapshot) {
      touchedRef.current = false
      currentRef.current = null
      return
    }
    if (touchedRef.current) {
      return
    }
    form.reset(JSON.parse(serverSnapshot) as ProjectIntroValues)
    /* Der Ruecksetzer ist keine Eingabe: er darf keinen Takt ausloesen. */
    lastRef.current = serverSnapshot
  }, [serverSnapshot, form])

  /*
   * Eine dauerhaft gueltige Lesefunktion. Sie haengt an einem Ref und
   * nicht an den Werten: eine bei jedem Tastendruck neu gebundene Funktion
   * baute den Speichertakt jedes Mal neu auf, und aus der Entprellung
   * wuerde stillschweigend ein Request je Anschlag.
   */
  const readRef = useRef(() => currentRef.current)
  useEffect(() => {
    onRegisterRead(readRef.current)
  }, [onRegisterRead])

  /** Eine Eingabe, geglaettet: Zeilenumbrueche gehoeren in keines der Felder. */
  const change = (next: (value: string) => void) => (value: string) => {
    touchedRef.current = true
    next(oneLine(value))
  }

  const hasCover = project.coverImageUrl != null && project.coverImageUrl !== ""

  return (
    <section
      aria-label={t("projectContent.intro.regionLabel")}
      className="flex flex-col gap-4"
    >
      {/*
       * Ohne Schreibrecht und ohne Bild bleibt die Flaeche fort: eine leere
       * Markenflaeche ueber dem Titel waere ein Rahmen um nichts, den
       * niemand fuellen kann.
       */}
      {(editable || hasCover) && (
        <Controller
          control={form.control}
          name="coverImageUrl"
          render={({ field }) => (
            <CoverImageField
              value={field.value}
              onChange={(next) => {
                touchedRef.current = true
                field.onChange(next)
              }}
              onUpload={async (file) => (await upload.mutateAsync(file)).url}
              uploading={upload.isPending}
              disabled={!editable}
              /* 16:9 wie gewuenscht; das Metadatenformular bleibt bei 7:4. */
              aspect="16/9"
            />
          )}
        />
      )}

      {editable ? (
        <>
          {/*
           * Die Gliederung der Seite. Sie steht neben dem Feld und nicht
           * darum: eine Ueberschrift, die ein Eingabefeld umschliesst,
           * haette keinen zugaenglichen Namen (SC 1.3.1, SC 4.1.2).
           */}
          <h1 className="sr-only">
            {values.title.trim() === ""
              ? t("project.metadata.untitledTitle")
              : values.title}
          </h1>

          <Controller
            control={form.control}
            name="title"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor={`${fieldId}-title`} className="sr-only">
                  {t("project.metadata.title.label")}
                </FieldLabel>
                <Textarea
                  {...field}
                  id={`${fieldId}-title`}
                  rows={1}
                  maxLength={TITLE_MAX_LENGTH}
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={`${fieldId}-title-counter`}
                  placeholder={t("project.metadata.title.placeholder")}
                  onKeyDown={preventNewline}
                  onChange={(event) =>
                    change(field.onChange)(event.target.value)
                  }
                  onFocus={() => setFocused("title")}
                  onBlur={() => {
                    setFocused(null)
                    field.onBlur()
                  }}
                  className={FIELD_FONT.title}
                />
                {/*
                 * Dauerhaft im Baum und nur verborgen, nicht ausgebaut:
                 * aria-describedby zeigt sonst beim Betreten des Feldes auf
                 * ein Element, das es in diesem Augenblick noch nicht gibt,
                 * und die Restanzahl wird nie vorgelesen (Befund des
                 * Frontend-Reviews).
                 */}
                <CharacterCounter
                  id={`${fieldId}-title-counter`}
                  value={field.value}
                  max={TITLE_MAX_LENGTH}
                  className={focused === "title" ? undefined : "sr-only"}
                />
                <FieldError
                  errors={[{ message: messageOf(fieldState.error, t) }]}
                />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="summary"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                {/*
                 * Unsichtbar, aber im Baum (KAN-83): die Beschriftung
                 * „Abstract" stand sichtbar in Ueberschriftengroesse ueber
                 * dem Feld und wurde fuer eine Gliederungsebene gehalten.
                 * Verschwinden darf sie trotzdem nicht, sonst verliert das
                 * Feld seinen zugaenglichen Namen (WCAG 2.2, SC 4.1.2).
                 * Sichtbar fuehrt jetzt der Platzhalter. Dasselbe Muster
                 * haelt diese Datei schon fuer den Titel.
                 */}
                <FieldLabel htmlFor={`${fieldId}-summary`} className="sr-only">
                  {t("project.metadata.summary.label")}
                </FieldLabel>
                <Textarea
                  {...field}
                  id={`${fieldId}-summary`}
                  rows={3}
                  aria-invalid={fieldState.invalid || undefined}
                  placeholder={t("project.metadata.summary.placeholder")}
                  onKeyDown={preventNewline}
                  onChange={(event) =>
                    change(field.onChange)(event.target.value)
                  }
                  onFocus={() => setFocused("summary")}
                  onBlur={() => {
                    setFocused(null)
                    field.onBlur()
                  }}
                  className={FIELD_FONT.summary}
                />
                {/*
                 * Ohne Zeichenzaehler: der Abstract ist Fliesstext, und die
                 * Grenze ist die des Servers (1024 Zeichen), keine
                 * Gestaltungsregel. Sie erscheint erst als Feldmeldung,
                 * wenn sie wirklich erreicht ist.
                 */}
                <FieldError
                  errors={[{ message: messageOf(fieldState.error, t) }]}
                />
              </Field>
            )}
          />

          {/*
           * Ein stiller Fehlschlag waere Datenverlust mit Ansage. Solange
           * die Eingaben das Schema verletzen, sendet der Takt die
           * Kopfangaben nicht; das steht hier und nicht nur als
           * Feldmeldung, weil der Speicherzustand in der Kopfzeile davon
           * nichts weiss. Ueber die Primitive und nicht als eigenes
           * Markup: sie traegt role="alert" und wird beim Einfuegen
           * verlaesslich angesagt (SC 4.1.3).
           */}
          {!valid && (
            <Alert variant="destructive">
              <AlertDescription>
                {t("projectContent.intro.notSaved")}
              </AlertDescription>
            </Alert>
          )}
        </>
      ) : (
        <>
          <h1 className={`min-w-0 ${TITLE_ROLE}`}>{project.title}</h1>
          {/* Ohne Beschriftung (KAN-83): der graue Absatz steht bereits
              richtig da, die Zeile darueber war die Ueberschrift
              „Abstract". */}
          {project.summary != null && project.summary !== "" && (
            <p className="type-body-lg text-muted-foreground">
              {project.summary}
            </p>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Uebersetzt eine Schemameldung.
 *
 * <p>Anders als im Metadatenformular gibt es hier keinen Zweig fuer einen
 * vom Server gesetzten Feldfehler: es gibt kein Absenden, an dem sich ein
 * 400 einem Feld zuordnen liesse. Ein Fehlschlag des Takts erscheint als
 * Meldung ueber dem Beitrag ({@code EditorPage}).
 */
function messageOf(
  error: { message?: string } | undefined,
  t: (key: string) => string
): string | undefined {
  return error?.message === undefined ? undefined : t(error.message)
}

/**
 * Titel und Abstract sind Fliesstext ohne harte Umbrueche; ein
 * Zeilenumbruch darin waere im Beitrag, auf jeder Kachel und in jeder
 * Liste ein unerwarteter Sprung. Verhindert wird er an der Taste und nicht
 * erst beim Speichern, damit gar nicht erst entsteht, was danach still
 * verschwaende.
 */
function preventNewline(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter") {
    event.preventDefault()
  }
}

/**
 * Dasselbe fuer den zweiten Weg hinein: eingefuegter Text bringt
 * Zeilenumbrueche mit, und die Taste faengt ihn nicht ab.
 */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ")
}

/**
 * Der Projekttitel sieht im Editor aus wie auf der oeffentlichen
 * Detailseite: dieselbe Rolle, dieselbe Farbe.
 *
 * <p>Er steht an beiden Stellen fuer dasselbe, und der Umschalter der
 * Kopfzeile fuehrt unmittelbar von einer in die andere. Ein Titel, der
 * dabei Groesse oder Farbe wechselt, liesse den Wechsel wie einen
 * Seitenwechsel aussehen. Vorbild ist {@code ProjectDetailPage}
 * ({@code type-title min-w-0 text-primary}).
 */
const TITLE_ROLE = "type-title text-primary"

/**
 * Der Rahmen der beiden Felder: keiner, auch nicht im Fokus.
 *
 * <p>Titel und Abstract sollen wie der Beitrag aussehen und nicht wie ein
 * Formular daneben. Weggenommen werden muessen vier Dinge der
 * Registry-Primitive, und jedes einzeln, weil tailwind-merge nur innerhalb
 * derselben Gruppe <em>und</em> desselben Modifikators aufraeumt: der Rand
 * ({@code border-0}), die Mindesthoehe von 4rem ({@code min-h-0}), die
 * Flaeche im dunklen Modus ({@code dark:bg-transparent}) und der Fokusring
 * ({@code focus-visible:ring-0}).
 *
 * <p><strong>Wie der Fokus trotzdem zu sehen ist.</strong> Bei einem
 * Textfeld traegt ihn die Schreibmarke; dazu kommt dieselbe leichte
 * Flaeche wie beim Ueberfahren. Sie steht ausdruecklich auch mit
 * {@code dark:}-Modifikator da: {@code dark:bg-transparent} und
 * {@code focus:bg-muted/40} haben dieselbe Spezifitaet, und im gebauten
 * CSS steht die dunkle Zeile spaeter, gewinnt also. Ohne
 * {@code dark:focus:bg-muted/40} blieb dunkel gar nichts uebrig (Befund
 * des Frontend-Reviews). Die Flaeche ist bewusst zurueckhaltend; ein
 * deutlicherer Anzeiger ohne Rahmen ist eine offene Gestaltungsfrage.
 *
 * <p><strong>Und kein Rollbalken.</strong> Das Feld waechst mit seinem
 * Inhalt, das besorgt {@code field-sizing-content} der Primitive; es
 * ueberlebt die Merge-Kette und wird hier nicht angetastet.
 * {@code overflow-hidden} nimmt den Balken, der sonst waehrend des
 * Wachsens aufblitzt. {@code resize-none} bleibt, denn ein Ziehgriff an
 * einer Ueberschrift waere ein Bedienelement ohne Zweck.
 */
const BARE_FIELD = [
  "resize-none overflow-hidden border-0 min-h-0 px-0 py-0",
  "bg-transparent dark:bg-transparent",
  "hover:bg-muted/40 focus:bg-muted/40",
  "dark:hover:bg-muted/40 dark:focus:bg-muted/40",
  "focus-visible:ring-0",
].join(" ")

/**
 * Die Schriftrollen der beiden Felder.
 *
 * <p><strong>Warum nicht einfach die Rollen-Klasse allein.</strong> Die
 * Rollen-Klassen stehen in {@code @layer components}, die
 * Registry-Primitive {@code Textarea} traegt {@code text-base} und
 * {@code md:text-sm} als Utilities, und Utilities gewinnen gegen die
 * Komponentenschicht. Ohne die beiden Ersatzklassen stuende der Titel auf
 * dem Desktop in 13 Pixeln da, ohne Fehler und ohne Warnung.
 *
 * <p><strong>Ein zweiter Wert entsteht trotzdem nicht:</strong> die
 * Ersatzklassen zeigen auf dieselben Tokens, aus denen die Rollen-Klasse
 * ihre Groesse nimmt. Familie und Schnitt bleiben ihr ueberlassen, dort
 * gibt es keinen Konflikt.
 */
const FIELD_FONT = {
  title: `${BARE_FIELD} ${TITLE_ROLE} text-[length:var(--fs-title)] leading-[var(--lh-title)] md:text-[length:var(--fs-title)]`,
  summary: `${BARE_FIELD} type-body-lg text-[length:var(--fs-body-lg)] leading-[var(--lh-body)] md:text-[length:var(--fs-body-lg)]`,
} as const
