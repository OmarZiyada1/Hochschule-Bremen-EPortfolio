import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId, useRef, type KeyboardEvent } from "react"
import {
  Controller,
  useForm,
  useWatch,
  type UseFormReturn,
} from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { ProjectDetailResponse } from "@/api/types"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
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
 * Die Kopfpartie ueber der Schreibflaeche: Titelbild und Projekttitel, beide
 * an Ort und Stelle aenderbar (KAN-36), in der Vorschau dazu die
 * Kurzbeschreibung als Vorspann (KAN-104).
 *
 * <p><strong>Bewusst neben dem Template.</strong> Der Figma-Frame
 * {@code Template / Studierende · Editor} zeichnet oben allein den Titel,
 * und zwar als reine Anzeige. Das Titelbild dort ebenfalls zu fuehren, ist
 * eine Nutzerentscheidung: es erscheint auf jeder Kachel und in jeder Liste,
 * und es erst auf der Metadatenseite einzutragen hiess, den Beitrag zu
 * verlassen, um sein Aussehen zu bestimmen.
 *
 * <p><strong>Die Kurzbeschreibung wird hier nicht bearbeitet</strong>
 * (KAN-104, Entscheidung). Eingetragen wird sie allein im
 * Metadatenformular. Beim Bearbeiten steht unter dem Titel keine
 * Kurzbeschreibung, auch nicht fuer Personen ohne Schreibrecht; in der
 * Vorschau erscheint sie als grauer Vorspann wie auf der Detailseite. Ob sie
 * erscheint, sagt die Seite ({@code showSummary}), denn diese Komponente
 * kennt den Modus nicht. Sie gehoert deshalb auch nicht zum Formular:
 * angezeigt wird sie aus {@code project}, und der Speichertakt traegt den
 * zuletzt vom Server bestaetigten Wert unveraendert mit
 * ({@code toProjectIntroUpdateRequest}).
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
 * der Ueberschrift. Ohne Schreibrecht und in der Vorschau (KAN-104) steht
 * der Titel als sichtbares {@code h1} da, dann braucht es die verborgene
 * Fassung nicht.
 *
 * <p><strong>Ein Feld und ein Schema.</strong> Geprueft wird mit
 * {@code projectIntroSchema}, einem Ausschnitt des einen
 * Metadaten-Schemas (Frontend-Regel 12).
 *
 * <p><strong>Ohne Rahmen</strong> (KAN-104, Entscheidung). Der gestrichelte
 * Rahmen aus KAN-105 um Titel und Kurzbeschreibung ist entfallen, und auch
 * das Titelfeld selbst traegt in keinem Zustand Rand oder Flaeche (siehe
 * {@code BARE_FIELD}).
 */
export function EditorIntro({
  project,
  editable,
  showSummary,
  onChange,
  onRegisterRead,
}: {
  project: ProjectDetailResponse
  /**
   * Ob die Felder zum Bearbeiten stehen: false ohne Schreibrecht (§4.1,
   * §6.1) und in der Vorschau des Editors (KAN-104). Ob gesendet werden
   * darf, entscheidet die Seite ({@code metadataRef}).
   */
  editable: boolean
  /**
   * Ob unter dem Titel die Kurzbeschreibung steht (KAN-104, Entscheidung):
   * allein in der Vorschau des Editors. {@code editable} kann das nicht
   * sagen, es ist in der Vorschau und ohne Schreibrecht gleichermassen
   * false, und beim Bearbeiten ohne Schreibrecht soll sie gerade nicht
   * erscheinen. Solange die Felder zum Bearbeiten stehen, bleibt der Wert
   * ohne Wirkung.
   */
  showSummary: boolean
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
   * Hier und ohne Bedingung gelesen, nicht erst in der Meldung unten:
   * react-hook-form berechnet isDirty nur, wenn der Wert vor einer Aenderung
   * schon gelesen wurde (Proxy des formState). Stuende er hinter
   * „editable ||", waere er auf der Schreibflaeche nie abonniert gewesen und
   * bliebe beim Wechsel in die Vorschau falsch (KAN-104).
   */
  const dirty = form.formState.isDirty
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
    /* Und ein uebernommener Stand zeigt seinen Grund wie ein geladener. */
    revealInvalidLoadedValues(form)
  }, [serverSnapshot, form])

  /*
   * Der geladene Stand, einmal beim Montieren (KAN-104). Auch wenn die
   * Felder gerade nicht zum Bearbeiten stehen: wer in der Vorschau oeffnet
   * und dann auf die Schreibflaeche wechselt, soll den Grund dort gleich
   * sehen. Ohne Schreibrecht bleibt das folgenlos, die Feldmeldung steht
   * nur am Feld, und die Warnung zum Speicherweg gilt dort erst einer
   * Eingabe.
   */
  useEffect(() => {
    revealInvalidLoadedValues(form)
  }, [form])

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

  /** Eine Eingabe, geglaettet: Zeilenumbrueche gehoeren nicht in den Titel. */
  const change = (next: (value: string) => void) => (value: string) => {
    touchedRef.current = true
    next(oneLine(value))
  }

  /*
   * Aus dem Formular und nicht aus dem Projekt (KAN-104): in der Vorschau
   * zeigt die Kopfpartie ein eben gewaehltes Titelbild schon, bevor der
   * Speichertakt es geschrieben hat, und ein eben entferntes nicht mehr.
   */
  const hasCover = values.coverImageUrl !== ""

  /* Derselbe Titel fuer beide Zweige; ein geleertes Feld ergaebe sonst eine
     Ueberschrift ohne Namen (SC 2.4.6). */
  const displayTitle =
    values.title.trim() === ""
      ? t("project.metadata.untitledTitle")
      : values.title

  /*
   * Die Kurzbeschreibung aus dem Serverstand und nicht aus einer Eingabe
   * (KAN-104): im Editor aendert sie niemand, und genau dieser Wert geht
   * auch im Speichertakt mit. Leer bleibt der Vorspann fort, wie auf der
   * Detailseite.
   */
  const summary = project.summary ?? ""

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
              /* Auf der Flaeche und nicht darunter: die Kopfpartie geht
                 unmittelbar in den Titel ueber, und ein Streifen mit
                 Bedienelementen dazwischen schoebe sich in diese Naht. In der
                 schmalen Vorschau-Spalte des Metadatenformulars bleibt es bei
                 der Leiste darunter. */
              controlPlacement="overlay"
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
          <h1 className="sr-only">{displayTitle}</h1>

          {/* Nur der Titel und ohne Rahmen darum (KAN-104, Entscheidung).
              Hoechstlaengenmeldung und Feldmeldung gehoeren zum Feld und
              stehen darunter; die Warnmeldung zum Speicherweg gilt der
              ganzen Kopfpartie und steht unter beiden Zweigen. */}
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
                  /* Bleibt, obwohl das Feld nicht mehr rot wird: Hilfsmittel
                     melden den Fehlerzustand darueber (SC 3.3.1, SC 4.1.2). */
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={`${fieldId}-title-limit`}
                  placeholder={t("project.metadata.title.placeholder")}
                  onKeyDown={preventNewline}
                  onChange={(event) =>
                    change(field.onChange)(event.target.value)
                  }
                  className={TITLE_FIELD}
                />
                {/*
                 * Die Hoechstlaengenmeldung (KAN-104, Entscheidung). Sie
                 * ersetzt die Restzeichenanzeige unter dem Titel; gemeldet
                 * wird erst, wenn nichts mehr hineinpasst.
                 *
                 * <p><strong>Ein Hinweis und kein Fehler:</strong> bei genau
                 * 100 Zeichen ist der Titel gueltig. Deshalb die
                 * Beschreibungsprimitive in ihrer eigenen gedaempften Farbe
                 * und nicht FieldError, die destruktiv faerbt und als alert
                 * dazwischenriefe.
                 *
                 * <p><strong>Dauerhaft im Baum, und nur der Text wechselt.</strong>
                 * Eine Live-Region, die erst mit ihrer Meldung entsteht, wird
                 * unter Umstaenden gar nicht angesagt (SC 4.1.3), und
                 * aria-describedby zeigte beim Betreten des Feldes ins Leere.
                 * Leer ist sie sr-only: so bleibt sie im Baum der Hilfsmittel,
                 * nimmt aber keinen Platz und keinen Abstand unter dem Titel
                 * ein.
                 */}
                <FieldDescription
                  id={`${fieldId}-title-limit`}
                  role="status"
                  className="empty:sr-only"
                >
                  {titleLimitReached(field.value, fieldState.invalid)
                    ? t("projectContent.intro.titleLimitReached", {
                        max: TITLE_MAX_LENGTH,
                      })
                    : null}
                </FieldDescription>
                <FieldError
                  errors={[{ message: messageOf(fieldState.error, t) }]}
                />
              </Field>
            )}
          />

          {/* Die Meldung zum Speicherweg steht unter beiden Zweigen, siehe
              dort (KAN-104). */}
        </>
      ) : (
        <>
          {/*
           * Der eingegebene Stand und nicht der gespeicherte (KAN-104). In
           * der Vorschau des Editors steht die Kopfpartie mit editable=false
           * da, und was seit dem letzten Speichertakt getippt wurde, soll
           * dort schon zu sehen sein. Das Formular bleibt dafuer montiert,
           * nur seine Felder treten ab. Fuer Personen ohne Schreibrecht
           * aendert sich nichts: ein unberuehrtes Formular uebernimmt jeden
           * neuen Serverstand (Effekt oben), die Werte sind dieselben.
           */}
          <h1 className={`min-w-0 ${TITLE_ROLE}`}>{displayTitle}</h1>
          {/* Der graue Vorspann wie auf der Detailseite, ohne Beschriftung
              (KAN-83), und nur in der Vorschau (KAN-104, Entscheidung). */}
          {showSummary && summary !== "" && (
            <p className="type-body-lg text-muted-foreground">{summary}</p>
          )}
        </>
      )}

      {/*
       * Ein stiller Fehlschlag waere Datenverlust mit Ansage. Solange die
       * Eingaben das Schema verletzen, sendet der Takt die Kopfangaben
       * nicht; das steht hier und nicht nur als Feldmeldung, weil der
       * Speicherzustand in der Kopfzeile davon nichts weiss. Ueber die
       * Primitive und nicht als eigenes Markup: sie traegt role="alert" und
       * wird beim Einfuegen verlaesslich angesagt (SC 4.1.3).
       *
       * <p><strong>Auch in der Vorschau</strong> (KAN-104): eine Auskunft
       * ueber das Speichern verschwindet nicht mit einem Ansichtswechsel.
       * Dort gilt sie nur fuer ein veraendertes Formular. Ein unveraendertes
       * steht auf einem Serverstand, und der hat die Pruefung des Servers
       * bestanden; ohne diese Bedingung blitzte die Meldung bei Personen
       * ohne Schreibrecht auf, bis die erste Pruefung des Schemas
       * zurueckkommt.
       */}
      {!valid && (editable || dirty) && (
        <Alert variant="destructive">
          <AlertDescription>
            {t("projectContent.intro.notSaved")}
          </AlertDescription>
        </Alert>
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
 * Prueft einen geladenen Stand sichtbar, wenn das Schema ihn beanstandet
 * (KAN-104).
 *
 * <p>react-hook-form berechnet beim Montieren und nach {@code reset} ueber
 * den Resolver allein {@code isValid}; Feldfehler setzt es erst mit der
 * ersten Eingabe. Ein Titel ueber {@code TITLE_MAX_LENGTH} Zeichen, wie ihn
 * der Server zulaesst (255, {@code ProjectUpdateRequest}), stuende sonst
 * ohne Feldmeldung da, und darunter allein die Warnung, dass nicht
 * gespeichert wird, ohne den Grund. Weitertippen hilft dabei nicht: das
 * native {@code maxLength} sperrt jede Eingabe, erst ein Loeschen loeste
 * die Pruefung aus. Bis KAN-104 nannte die Restzeichenanzeige den
 * Ueberhang; seit sie entfallen ist, nennt ihn die Feldmeldung.
 *
 * <p>Nur bei einem Verstoss und nicht bei jedem Stand: ein gueltiger
 * braucht keine Meldung. {@code trigger} aendert keinen Wert, setzt kein
 * {@code touchedRef} und nimmt keinen Fokus; der Speichertakt bleibt also
 * unberuehrt, gesendet wird weiterhin nur, was hier getippt wurde.
 */
function revealInvalidLoadedValues(form: UseFormReturn<ProjectIntroValues>) {
  if (!projectIntroSchema.safeParse(form.getValues()).success) {
    void form.trigger()
  }
}

/**
 * Ob der Titel genau die Hoechstlaenge erreicht hat und nichts mehr
 * hineinpasst (KAN-104, Entscheidung).
 *
 * <p>Gemessen am Feldwert und nicht am getrimmten Titel: das native
 * {@code maxLength} zaehlt genauso, auch ein Randleerzeichen belegt also
 * einen Platz. Das ist keine Pruefung neben dem Schema, sondern allein die
 * Frage, ob der Hinweis steht.
 *
 * <p><strong>Genau an der Grenze und nicht darueber.</strong> Laenger als
 * die Grenze wird ein Titel nur, wenn er so vom Server kommt (dort gelten
 * 255 Zeichen). Dann ist die Grenze ueberschritten und nicht erreicht, und
 * den Grund nennt die Feldmeldung, die {@code revealInvalidLoadedValues}
 * beim Laden herstellt. Bis deren Pruefung zurueckkommt, ist
 * {@code invalid} noch false; mit einem Vergleich auf „mindestens" stuende
 * der Hinweis in dieser Zeit in der Live-Region und wuerde angesagt.
 *
 * <p><strong>Kein Hinweis, solange das Feld eine Meldung traegt</strong>,
 * etwa bei einem Titel aus lauter Leerzeichen: ein gueltiger Hinweis ueber
 * einer Fehlermeldung widerspraeche ihr.
 */
function titleLimitReached(value: string, invalid: boolean): boolean {
  return value.length === TITLE_MAX_LENGTH && !invalid
}

/**
 * Der Titel ist eine Zeile ohne harte Umbrueche; ein Zeilenumbruch darin
 * waere im Beitrag, auf jeder Kachel und in jeder Liste ein unerwarteter
 * Sprung. Verhindert wird er an der Taste und nicht erst beim Speichern,
 * damit gar nicht erst entsteht, was danach still verschwaende.
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
 * <p>Er steht an beiden Stellen fuer dasselbe, und seit KAN-104 wechselt der
 * Umschalter der Kopfzeile an Ort und Stelle zwischen Schreibflaeche und
 * Vorschau, in der diese Kopfpartie als Text steht. Ein Titel, der dabei
 * Groesse oder Farbe wechselt, liesse den Wechsel springen. Vorbild ist
 * {@code ProjectDetailPage} ({@code type-title min-w-0 text-primary}).
 */
const TITLE_ROLE = "type-title text-primary"

/**
 * Das Titelfeld traegt weder Rahmen noch Flaeche, in keinem Zustand und in
 * hell wie dunkel (KAN-104, Entscheidung).
 *
 * <p>Der Titel soll aussehen wie der Beitrag und nicht wie ein Formular
 * daneben. Weggenommen wird, was die Registry-Primitive {@code Textarea}
 * mitbringt, und zwar jede Klasse mit genau ihrem Modifikator:
 * tailwind-merge raeumt nur innerhalb derselben Gruppe <em>und</em>
 * desselben Modifikators auf. Ein {@code border-0} ohne Modifikator liesse
 * etwa {@code aria-invalid:ring-3} stehen. Die Primitive selbst bleibt
 * unveraendert (Frontend-Regel 11). Im Einzelnen:
 *
 * <ul>
 *   <li>Rand, Randfarbe, Mindesthoehe von 4rem und Innenabstand
 *       ({@code border-0}, {@code border-transparent}, {@code min-h-0},
 *       {@code px-0}, {@code py-0});</li>
 *   <li>die Flaeche, auch dunkel: {@code dark:bg-transparent} gegen
 *       {@code dark:bg-input/30};</li>
 *   <li>Fokusring und Randfarbe im Fokus ({@code focus-visible:ring-0},
 *       {@code focus-visible:ring-transparent},
 *       {@code focus-visible:border-transparent});</li>
 *   <li>der rote Fehlerzustand, hell ({@code aria-invalid:border-transparent},
 *       {@code aria-invalid:ring-0}, {@code aria-invalid:ring-transparent})
 *       und dunkel ({@code dark:aria-invalid:border-transparent},
 *       {@code dark:aria-invalid:ring-transparent}). Fort ist allein die
 *       Optik: {@code aria-invalid} bleibt am Feld, und die Feldmeldung
 *       darunter nennt den Fehler als Text.</li>
 * </ul>
 *
 * <p><strong>Den Fokus zeigt allein die Schreibmarke</strong> (KAN-104,
 * Entscheidung der Person; nicht wieder einbauen). Die leichte Flaeche beim
 * Ueberfahren und im Fokus ({@code hover:bg-muted/40},
 * {@code focus:bg-muted/40} und ihre {@code dark:}-Fassungen) ist
 * entfallen, und den Umriss des Browsers nimmt die Primitive mit
 * {@code outline-none} ohnehin. SC 2.4.7 verlangt fuer die
 * Tastaturbedienung einen sichtbaren Fokusanzeiger, legt seine Form aber
 * nicht fest. In einem Textfeld ist das die blinkende Schreibmarke: sie
 * erscheint genau dann, wenn das Feld den Fokus hat, und zeigt, wo die
 * Eingabe wirkt. Die Schreibmarke erbt die Textfarbe {@code text-primary}
 * und steht damit in hell wie dunkel im Kontrast der Titelrolle.
 *
 * <p><strong>Und kein Rollbalken.</strong> Das Feld waechst mit seinem
 * Inhalt, das besorgt {@code field-sizing-content} der Primitive; es
 * ueberlebt die Merge-Kette und wird hier nicht angetastet.
 * {@code overflow-hidden} nimmt den Balken, der sonst waehrend des
 * Wachsens aufblitzt. {@code resize-none} bleibt, denn ein Ziehgriff an
 * einer Ueberschrift waere ein Bedienelement ohne Zweck.
 */
const BARE_FIELD = [
  "resize-none overflow-hidden border-0 border-transparent min-h-0 px-0 py-0",
  "bg-transparent dark:bg-transparent",
  "focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-transparent",
  "aria-invalid:border-transparent aria-invalid:ring-0 aria-invalid:ring-transparent",
  "dark:aria-invalid:border-transparent dark:aria-invalid:ring-transparent",
].join(" ")

/**
 * Die Klassen des Titelfeldes: ohne Rahmen ({@code BARE_FIELD}) und in der
 * Schriftrolle des Titels.
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
const TITLE_FIELD = `${BARE_FIELD} ${TITLE_ROLE} text-[length:var(--fs-title)] leading-[var(--lh-title)] md:text-[length:var(--fs-title)]`
