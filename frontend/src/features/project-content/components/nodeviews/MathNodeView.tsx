import type { ReactNodeViewProps } from "@tiptap/react"
import { PencilIcon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditorContext } from "@/features/project-content/EditorContext"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { LazyMathBlock } from "@/features/project-content/renderer/LazyMathBlock"

/**
 * FORMULA auf der Schreibflaeche (Contract 2.5, Template „Editor").
 *
 * <p><strong>Zu sehen ist die gesetzte Formel, nicht ihr Quelltext</strong>
 * (WYSIWYG-Umbau in KAN-36, wie bei den Medienbloecken). Der Block zeigt
 * dieselbe Darstellung wie der Renderer der oeffentlichen Seite; das
 * Eingabefeld erscheint erst auf den Bearbeiten-Knopf rechts daneben und
 * verschwindet danach wieder. Zuvor stand das grosse Feld dauerhaft unter
 * jeder Formel, und der Beitrag las sich beim Schreiben anders als danach.
 *
 * <p><strong>Ein frisch eingefuegter Block oeffnet sich von selbst.</strong>
 * Er hat noch keine Formel, und eine leere gesetzte Formel gaebe es nicht zu
 * sehen; hier ist das Feld also der Inhalt und nicht die Ausnahme.
 *
 * <p><strong>Waehrend des Tippens wird gerendert, aber nicht bei jedem
 * Zeichen.</strong> Eine halbfertige Formel ist fehlerhaft, und die
 * Fehlermeldung des Renderers blitzte bei jedem Tastendruck auf; das las
 * sich wie ein Defekt und war der Grund fuer den fruehen Zwischenschritt
 * „Rendern". Statt eines Knopfes steht jetzt eine kurze Ruhepause davor
 * ({@link PREVIEW_DELAY_MS}): wer weiterschreibt, sieht keinen Fehler, wer
 * innehaelt, sieht sein Ergebnis. Ctrl beziehungsweise Cmd und Enter
 * schliesst die Bearbeitung sofort, so steht es im Template.
 *
 * <p><strong>Geschrieben wird in die Knotenattribute, nicht in einen
 * zweiten Zustand.</strong> Die Vorschau liest {@code node.attrs.latex} wie
 * der Renderer auch; der Entwurf im Feld ist nur der Weg dorthin. Damit gibt
 * es keine zweite Wahrheit ueber die Formel, und ein Verlassen der Seite
 * traegt den zuletzt gesetzten Stand in den Speichertakt.
 *
 * <p>KaTeX kommt ueber {@code LazyMathBlock} und wird erst beim ersten
 * Rendern nachgeladen: die Bibliothek ist gross, und die meisten Beitraege
 * enthalten keine Formel.
 */

/**
 * Ruhepause vor dem Rendern des Entwurfs, in Millisekunden.
 *
 * <p>Kurz genug, dass es sich unmittelbar anfuehlt, lang genug, dass eine
 * Formel im Entstehen nicht als Fehler erscheint. Derselbe Bereich wie beim
 * Speichertakt, nur schneller: hier wartet niemand auf das Netz.
 */
const PREVIEW_DELAY_MS = 400

export function MathNodeView({
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps) {
  const { t } = useTranslation()
  const { editable } = useEditorContext()
  const fieldId = useId()
  const latex = (node.attrs as { latex: string | null }).latex ?? ""
  const hasFormula = latex.trim() !== ""

  const [editing, setEditing] = useState(!hasFormula)
  const [draft, setDraft] = useState(latex)

  /*
   * Verschwindet die Formel von aussen, geht das Feld wieder auf.
   *
   * <p>Genau ein Weg fuehrt dorthin: Rueckgaengig. Ohne das stuende danach
   * ein Block ohne Formel, ohne Stift-Knopf und ohne Feld da, also ohne
   * jeden Weg zurueck, und der naechste Speichertakt liesse ihn aus der
   * Blockliste fallen ({@code isReadyToSave}), womit er serverseitig fort
   * waere (Befund des Frontend-Reviews).
   *
   * <p>Angepasst wird waehrend des Renderns und nicht in einem Effekt
   * (React-Muster „Zustand an geaenderte Props anpassen", wie in
   * {@code LoginPage}): der Zustand haengt an einer Eigenschaft des
   * Knotens, ein Effekt braechte einen zweiten Durchlauf mit falschem
   * Zwischenbild.
   *
   * <p>Mit dem geleerten Feld kollidiert das nicht: solange nur der Entwurf
   * leer ist, bleibt {@code latex} stehen, {@code hasFormula} also wahr.
   */
  const [lastHasFormula, setLastHasFormula] = useState(hasFormula)
  if (lastHasFormula !== hasFormula) {
    setLastHasFormula(hasFormula)
    if (!hasFormula) {
      setDraft("")
      setEditing(true)
    }
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)

  /*
   * Die Schreibfunktion ueber einen Ref und nicht als Abhaengigkeit des
   * Effekts: Tiptap gibt sie bei jedem Rendern neu herein, und ein Rendern
   * loest jede Transaktion aus. Als Abhaengigkeit setzte der Effekt seinen
   * Zeitgeber staendig zurueck, und die Vorschau erschiene nie.
   */
  const applyRef = useRef(updateAttributes)
  useEffect(() => {
    applyRef.current = updateAttributes
  })

  /*
   * <p><strong>Ein leeres Feld wird nicht geschrieben.</strong> Es ist ein
   * Zwischenstand des Tippens und keine Aussage „diese Formel soll weg".
   * Landete es am Knoten, fiele der Block beim naechsten Speichertakt aus
   * der Liste ({@code isReadyToSave} in blockSerialization.ts), und weil der
   * PUT die Liste vollstaendig ersetzt, waere er serverseitig fort, ohne
   * dass es jemand gesagt haette (Befund des Frontend-Reviews). Die zuletzt
   * gueltige Formel bleibt deshalb stehen, bis eine neue getippt ist.
   */
  /*
   * <p><strong>Geschrieben wird nur nach einer Eingabe.</strong> Der Takt
   * haengt an einem Merker aus {@code onChange} und nicht bloss daran, dass
   * Entwurf und Knoten auseinanderlaufen: sonst schriebe er auch dann
   * zurueck, wenn der Knoten sich von aussen geaendert hat, und ein
   * Rueckgaengig bei offenem Feld waere nach 400 ms wieder aufgehoben
   * (Befund des Frontend-Reviews).
   */
  const draftTouched = useRef(false)
  useEffect(() => {
    if (
      !editing ||
      !draftTouched.current ||
      draft === latex ||
      draft.trim() === ""
    ) {
      return
    }
    const timer = window.setTimeout(() => {
      draftTouched.current = false
      applyRef.current({ latex: draft })
    }, PREVIEW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [editing, draft, latex])

  /*
   * Der Fokus folgt dem Umschalten und nur ihm.
   *
   * <p><strong>{@code selected} steht bewusst nicht in dieser Liste.</strong>
   * Tiptap wechselt das Prop, sobald der Knoten ausgewaehlt oder abgewaehlt
   * wird, und ein Klick auf die Formel tut das ebenso wie ein Klick daneben
   * (ein Atom-Knoten wird vom Klick zur NodeSelection, prosemirror-view
   * {@code selectClickedLeaf}). Stand es hier, holte ein Klick in einen
   * anderen Absatz den Fokus in das offene Feld zurueck, und ein Klick auf
   * die fertige Formel setzte ihn auf den Stift-Knopf, weg aus der
   * Schreibflaeche (Befund des Frontend-Reviews; SC 2.4.3 regelt die
   * Reihenfolge, nicht das Kapern).
   *
   * <p><strong>Verglichen wird der vorige Wert</strong> und nicht „schon
   * aufgebaut": React ruft jeden Effekt im StrictMode beim Einhaengen
   * zweimal auf, und ein einmal verbrauchter Waechter faellt beim zweiten
   * Lauf in den Fokuszweig. Ein geladener Beitrag zoege den Fokus dann beim
   * Oeffnen auf einen Stift-Knopf mitten im Text.
   */
  const lastEditing = useRef(editing)
  useEffect(() => {
    if (lastEditing.current === editing) {
      return
    }
    lastEditing.current = editing
    if (editing) {
      textareaRef.current?.focus()
    } else {
      editButtonRef.current?.focus()
    }
  }, [editing])

  /*
   * Der frisch eingefuegte Block bekommt den Fokus ins Feld, und zwar genau
   * einmal.
   *
   * <p><strong>Warum das nicht im Effekt darueber steht.</strong> Beim
   * ersten Aufbau ist {@code selected} immer {@code false}: die
   * Knotenansicht von Tiptap setzt es in {@code mount()} fest so und meldet
   * die Auswahl erst eine Bildwiederholung spaeter. Eine Abfrage im ersten
   * Durchlauf traefe deshalb nie zu. Dieser Effekt wartet auf die Meldung
   * und schaltet sich danach ab.
   *
   * <p>Geruestet ist er nur fuer den Block, der leer zur Welt kam, also den
   * gerade eingefuegten. Ein geladener Beitrag mit Formeln darf den Fokus
   * nicht an sich reissen, waehrend anderswo geschrieben wird.
   */
  const initialFocusPending = useRef(!hasFormula)
  useEffect(() => {
    if (!initialFocusPending.current || !selected) {
      return
    }
    /*
     * Einen Bildaufbau spaeter, und das ist kein Kunstgriff: das Einfuegen
     * laeuft ueber {@code chain().focus()}, der Editor holt den Fokus also
     * unmittelbar danach auf die Schreibflaeche. Sofort gesetzt, waere er
     * eine Zeile spaeter wieder fort; hier gewinnt der letzte, und das soll
     * das Feld sein.
     *
     * <p>Der Waechter faellt erst <em>im</em> Bildaufbau, nicht davor: im
     * StrictMode raeumt React den ersten Lauf wieder ab, und ein vorher
     * verbrauchter Waechter liesse den zweiten Lauf aussteigen. Der
     * Erstfokus bliebe dann aus.
     */
    const frame = window.requestAnimationFrame(() => {
      initialFocusPending.current = false
      textareaRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selected])

  /**
   * Uebernimmt den Entwurf sofort und schliesst das Feld.
   *
   * <p><strong>Ein leerer Entwurf schliesst nicht.</strong> Ohne Formel gibt
   * es nichts anzuzeigen: uebrig bliebe der Hinweis, dass etwas fehlt, und
   * kein Weg zurueck ins Feld, denn der Bearbeiten-Knopf haengt an der
   * gerenderten Formel. Der Fertig-Knopf ist dafuer gesperrt; Escape und
   * Strg+Enter fuehren an ihm vorbei und brauchen dieselbe Bedingung
   * (Befund des Frontend-Reviews).
   *
   * <p>Steht am Knoten noch eine Formel, ist das leere Feld ein
   * abgebrochener Austausch: das Feld geht auf die gespeicherte Formel
   * zurueck und schliesst. Nur der frisch eingefuegte Block, der noch nie
   * eine hatte, bleibt offen; ihn wird man ueber die Blockbedienung los und
   * nicht durch Leeren eines Feldes.
   */
  const closeEditor = () => {
    if (draft.trim() === "") {
      if (hasFormula) {
        setDraft(latex)
        setEditing(false)
      }
      return
    }
    if (draft !== latex) {
      updateAttributes({ latex: draft })
    }
    setEditing(false)
  }

  return (
    <MediaShell
      incompleteHint={
        hasFormula ? null : t("projectContent.formula.incomplete")
      }
    >
      {hasFormula && (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <LazyMathBlock latex={latex} />
          </div>

          {editable && !editing && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    ref={editButtonRef}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setDraft(latex)
                      setEditing(true)
                    }}
                  />
                }
              >
                <PencilIcon aria-hidden="true" />
                <span className="sr-only">
                  {t("projectContent.formula.edit")}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t("projectContent.formula.edit")}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {editable && editing && (
        <Field contentEditable={false}>
          <FieldLabel htmlFor={fieldId}>
            {t("projectContent.formula.label")}
          </FieldLabel>
          <Textarea
            ref={textareaRef}
            id={fieldId}
            value={draft}
            rows={3}
            spellCheck={false}
            placeholder={t("projectContent.formula.placeholder")}
            aria-describedby={`${fieldId}-hint`}
            onChange={(event) => {
              draftTouched.current = true
              setDraft(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                closeEditor()
                return
              }
              /* Escape schliesst nur die Bearbeitung, es verwirft nichts:
                 der Entwurf steht laengst am Knoten, und ein stilles
                 Zuruecknehmen des Gesehenen waere die groessere
                 Ueberraschung. Ohne stopPropagation nimmt der Editor die
                 Taste und raeumt die Auswahl auf. */
              if (event.key === "Escape") {
                event.preventDefault()
                event.stopPropagation()
                closeEditor()
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <FieldDescription id={`${fieldId}-hint`}>
              {t("projectContent.formula.hint")}
            </FieldDescription>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={closeEditor}
              /* Ohne Formel gibt es nichts zu schliessen: der Block zeigte
                 danach eine leere Flaeche ohne Weg zurueck ins Feld. */
              disabled={draft.trim() === ""}
            >
              {t("projectContent.formula.done")}
            </Button>
          </div>
        </Field>
      )}
    </MediaShell>
  )
}
