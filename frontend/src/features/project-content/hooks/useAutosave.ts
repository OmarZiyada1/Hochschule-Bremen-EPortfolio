import { useCallback, useEffect, useRef, useState } from "react"

import { replaceBlocks } from "@/api/queries/blocks"
import { updateProject } from "@/api/queries/projects"
import { isApiError, type ApiError } from "@/api/errors"
import type { ProjectDetailResponse, ProjectUpdateRequest } from "@/api/types"
import {
  docToBlocks,
  type PreviousBlock,
} from "@/features/project-content/blockSerialization"
import type { ProjectDocument } from "@/features/project-content/blockTypes"

/**
 * Der Speichertakt des Editors (Contract 6.1, 6.4).
 *
 * <p><strong>Zwei Wege, ein Takt, eine Version.</strong> Der Editor
 * schreibt an zwei Stellen: den Inhalt ueber
 * {@code PUT /projects/{id}/blocks} und die Kopfangaben (Titelbild, Titel,
 * Kurzbeschreibung) ueber {@code PUT /projects/{id}}. Zusammengefasst wird
 * das nicht, §6.1 trennt Inhalt und Metadaten. Beide erhoehen aber
 * dieselbe {@code Project.version} ({@code BlockService.replace} ruft
 * {@code project.touch()}), und deshalb duerfen sie nicht nebeneinander
 * laufen: der zweite ginge mit der Version los, die der erste gerade
 * veraltet hat, und der Takt bliebe nach dem 409 dauerhaft stehen. Dieser
 * Hook fuehrt sie darum <em>nacheinander</em> und reicht die Version aus
 * jeder Antwort an den naechsten Request weiter.
 *
 * <p><strong>Entprellt, und immer nur einer.</strong> Zwei ueberlappende
 * Takte erzeugen zuverlaessig einen Versionskonflikt gegen sich selbst: der
 * zweite geht mit der Version los, die der erste gerade veraltet hat.
 * Waehrend ein Lauf offen ist, wird deshalb nur gemerkt, dass es wieder
 * etwas zu tun gibt, und danach genau einmal nachgesetzt.
 *
 * <p><strong>Die Antwort wird uebernommen.</strong> Sie traegt die neue
 * {@code version} und die IDs der angelegten Bloecke. Ohne beides schickte
 * der naechste Takt dieselben Bloecke wieder ohne {@code id}, der Server
 * legte sie neu an, und blockbezogene Kommentare waeren dauerhaft
 * unmoeglich.
 *
 * <p><strong>409 wird nie wiederholt</strong> (§6.4). Ein zweiter Versuch
 * mit der neuen Version ueberschriebe genau die fremde Aenderung, vor der
 * das Locking schuetzt. Der Takt bleibt danach stehen, bis die Seite neu
 * geladen hat; alles Weitere entscheidet die Person am Bildschirm.
 *
 * <p><strong>Stehen bleibt er nicht dauerhaft.</strong> Der Ruecksetzer auf
 * {@code version} nimmt die Sperre wieder zurueck, sobald ein neues Lesen
 * durchgelaufen ist: nach „Serverstand laden" im Konfliktdialog speichert
 * der Takt also von selbst weiter. Nach „Eigene Fassung behalten" bleibt er
 * angehalten, und das ist gewollt: die Person hat sich ausdruecklich gegen
 * den Serverstand entschieden, und jeder weitere Takt traefe denselben
 * Konflikt.
 *
 * <p><strong>Ein Takt ohne gemeldete Aenderung schreibt nichts zurueck</strong>
 * (KAN-86, §6.4). Bis dahin schickte der erste Takt nach jedem Lesen den
 * unveraenderten Stand, erhoehte die Version ohne Aenderung und erzeugte in
 * jeder anderen offenen Sitzung genau den Konflikt, den das Locking
 * abfedern soll. Seit die Bearbeitungssperre aus §6.9 davor steht, faellt
 * das doppelt ins Gewicht: eine Sitzung, die nur liest, haette der
 * schreibenden die Version unter den Fuessen weggezogen.
 *
 * <p><strong>Ein Fehlschlag ist sichtbar.</strong> Ein stiller ist
 * Datenverlust mit Ansage: wer weiterschreibt, glaubt, es sei gespeichert.
 */

export type AutosaveState =
  "idle" | "pending" | "saving" | "saved" | "error" | "conflict"

/** Eine Dreiviertelsekunde: lang genug, dass ein Wort nicht drei Takte ausloest. */
const DEBOUNCE_MS = 1200

/**
 * Obergrenze zwischen erster ungespeicherter Aenderung und Senden.
 *
 * <p><strong>Ohne sie hat eine reine Entprellung eine Luecke</strong>, die
 * beim Schreiben besonders leicht auftritt: jeder Tastendruck setzt den
 * Wecker zurueck, und wer zehn Minuten am Stueck tippt, ohne eine Pause von
 * 1,2 Sekunden zu machen, hat zehn Minuten lang nichts gespeichert. Ein
 * Absturz, ein geschlossener Tab oder ein Netzwechsel kostet dann alles.
 * Mit der Obergrenze wird spaetestens nach zehn Sekunden einmal gesendet;
 * die Zahl der Requests steigt dadurch praktisch nicht, denn wer eine Pause
 * macht, loest ohnehin vorher aus.
 */
const MAX_WAIT_MS = 10000

export type Autosave = {
  state: AutosaveState
  error: ApiError | null
  /** Meldet eine Aenderung an; der Takt entscheidet, wann gesendet wird. */
  schedule: () => void
  /**
   * Speichert sofort und wartet ab.
   *
   * <p>Das Ergebnis kommt als Rueckgabewert und nicht ueber den Zustand:
   * wer danach einreicht oder die Seite verlaesst, muss <em>wissen</em>, ob
   * der letzte Stand drin ist, und ein Zustand aus dem vorigen Rendern
   * beantwortet das nicht.
   */
  flush: () => Promise<boolean>
}

export function useAutosave({
  projectId,
  enabled,
  version,
  blocks,
  baseline,
  readDocument,
  readMetadata,
  onMetadataSaved,
}: {
  projectId: string
  /**
   * Falsch heisst: den <em>Inhalt</em> nicht speichern (read-only Status
   * oder Loecher im Bestand).
   *
   * <p>Die Kopfangaben haengen ausdruecklich nicht daran: ein Block, den
   * diese Ansicht nicht lesen kann, ist ein Grund, den Inhalt nicht
   * zurueckzuschreiben, aber keiner, den Titel festzuhalten. Ob sie
   * geaendert werden duerfen, beantwortet {@link readMetadata} mit
   * {@code null}.
   */
  enabled: boolean
  /** Version aus dem letzten Lesen; danach fuehrt der Hook sie selbst. */
  version: number
  /** Blockliste aus dem letzten Lesen, fuer die stabilen IDs. */
  blocks: readonly PreviousBlock[]
  /**
   * Das gelesene Dokument, also der Stand, mit dem die Schreibflaeche
   * aufgebaut wurde. Er ist der Bezugspunkt des Takts: solange nichts
   * anderes darin steht, gibt es nichts zu schreiben.
   *
   * <p><strong>Warum als Dokument und nicht als Blockliste</strong>, obwohl
   * {@link blocks} dieselbe Antwort traegt: verglichen wird der Abdruck, den
   * {@code docToBlocks} erzeugt, und der entsteht nur aus einem Dokument.
   * Ein aus der Liste nachgebauter Abdruck waere ein zweiter Weg zu
   * demselben Wert und wiche beim ersten Feld ab, das die Serialisierung
   * normalisiert.
   *
   * <p>{@code null}, solange nichts gelesen ist.
   */
  baseline: ProjectDocument | null
  /** Liefert den aktuellen Stand der Schreibflaeche. */
  readDocument: () => ProjectDocument | null
  /**
   * Liefert die zu schreibende Metadatenkarte ohne {@code version}, oder
   * {@code null}, wenn nichts zu tun ist.
   *
   * <p><strong>Der Vergleich liegt beim Aufrufer</strong> und nicht hier:
   * er kennt den zuletzt vom Server bestaetigten Stand (die Antwort steht
   * im Query-Cache) und kann daran ablesen, ob sich etwas geaendert hat.
   * Ein Merkmal im Takt muesste denselben Stand ein zweites Mal fuehren
   * und liefe beim ersten Takt eines frisch geladenen Projekts ins Leere:
   * es kennt noch nichts und schickte die unveraenderte Karte los, womit
   * ein Beitrag allein vom Ansehen eine neue Version bekaeme (§6.4).
   */
  readMetadata: () => Omit<ProjectUpdateRequest, "version"> | null
  /** Meldet die Antwort des Metadaten-PUT, damit der Cache sie uebernimmt. */
  onMetadataSaved: (project: ProjectDetailResponse) => void
}): Autosave {
  const [state, setState] = useState<AutosaveState>("idle")
  const [error, setError] = useState<ApiError | null>(null)

  const versionRef = useRef(version)
  const previousRef = useRef<readonly PreviousBlock[]>(blocks)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef<Promise<boolean> | null>(null)
  const againRef = useRef(false)
  const stoppedRef = useRef(false)
  /* Was zuletzt tatsaechlich beim Server ankam. Verhindert einen Takt, der
     nichts aendert, etwa nach einer blossen Auswahlbewegung. */
  const savedRef = useRef<string | null>(null)
  /* Wann die erste noch nicht gesendete Aenderung eintraf. Daraus rechnet
     der Takt die Obergrenze; null heisst „nichts offen". */
  const pendingSinceRef = useRef<number | null>(null)

  /*
   * Die zuletzt gelesene Blockliste, in jedem Rendern nachgefuehrt. Sie
   * darf nicht in den Abhaengigkeiten des Ruecksetzers stehen: der
   * Aufrufer reicht sie mit einem Rueckfall auf die leere Liste herein,
   * und der ist bei jedem Rendern ein neues Array. Der Ruecksetzer liefe
   * dann dauernd, wuerfe die uebernommene Version wieder weg und schickte
   * den naechsten Takt mit einer veralteten Version los.
   */
  const latestBlocks = useRef(blocks)
  useEffect(() => {
    latestBlocks.current = blocks
  })

  /*
   * Das gelesene Dokument, aus demselben Grund ueber einen Ref wie die
   * Blockliste darueber: es haengt am Query-Ergebnis und darf den
   * Ruecksetzer nicht selbst ausloesen.
   */
  const baselineRef = useRef(baseline)
  useEffect(() => {
    baselineRef.current = baseline
  })

  /*
   * Der Rueckmelder fuer die gespeicherten Kopfangaben, aus demselben
   * Grund ueber einen Ref wie {@code runRef} weiter unten: er schliesst
   * ueber den QueryClient und die Projekt-ID und ist bei jedem Rendern
   * eine neue Funktion. Stuende er in den Abhaengigkeiten von
   * {@code save}, entstuende der ganze Takt bei jedem Rendern neu.
   */
  const onMetadataSavedRef = useRef(onMetadataSaved)
  useEffect(() => {
    onMetadataSavedRef.current = onMetadataSaved
  })

  /*
   * Ein neues Lesen (erster Abruf, Neuladen nach Konflikt) setzt den Takt
   * zurueck: Version und IDs sind danach andere.
   *
   * <p>Erkannt wird es an der {@code version} und nicht an der Liste. Sie
   * ist der Stand des Projekts (§6.4): eine andere Version heisst eine
   * andere Antwort, und dieselbe Version heisst dieselbe Liste. Effekte
   * laufen in der Reihenfolge ihrer Deklaration, die Liste oben ist also
   * bereits nachgefuehrt.
   */
  useEffect(() => {
    versionRef.current = version
    previousRef.current = latestBlocks.current
    /*
     * Der gelesene Stand ist der bestaetigte, und zwar sofort. Bis KAN-86
     * stand hier {@code null}, und der erste Takt schickte deshalb den
     * unveraenderten Inhalt zurueck: jeder Fingerabdruck ist ungleich
     * {@code null}. Der Beitrag bekam allein vom Ansehen eine neue Version,
     * und jede andere offene Sitzung lief in genau den 409, den §6.4
     * abfedern soll. Gebildet wird der Abdruck ueber denselben Weg wie im
     * Takt ({@code docToBlocks} mit derselben Vorgaengerliste), sonst
     * unterschieden sich zwei Abdruecke desselben Inhalts.
     */
    savedRef.current =
      baselineRef.current === null
        ? null
        : JSON.stringify(
            docToBlocks(baselineRef.current, latestBlocks.current)
          )
    stoppedRef.current = false
    pendingSinceRef.current = null
  }, [version])

  const save = useCallback(async (): Promise<boolean> => {
    if (stoppedRef.current) {
      return false
    }

    /* Der Inhalt, sofern er ueberhaupt geschrieben werden darf und sich
       seit der letzten Bestaetigung geaendert hat. */
    const document = enabled ? readDocument() : null
    const payload =
      document === null ? null : docToBlocks(document, previousRef.current)
    const fingerprint = payload === null ? null : JSON.stringify(payload)

    const blocksToSend =
      payload !== null && fingerprint !== savedRef.current ? payload : null

    /* Die Kopfangaben. Der Aufrufer hat bereits verglichen. */
    const metadataToSend = readMetadata()

    if (blocksToSend === null && metadataToSend === null) {
      /* „idle" bleibt „idle": auf einem read-only Beitrag leert jeder Weg
         aus der Seite heraus den Takt, und ein „Gespeichert" waere dort
         eine Meldung ueber etwas, das nie speicherbar war. */
      setState((current) => (current === "idle" ? current : "saved"))
      return true
    }

    setState("saving")
    try {
      /*
       * Erst der Inhalt, dann die Kopfangaben, und die zweite Anfrage geht
       * mit der Version aus der ersten Antwort los. Umgekehrt oder
       * gleichzeitig gaebe es einen 409 gegen die eigene vorige
       * Speicherung (§6.4).
       */
      if (blocksToSend !== null) {
        const response = await replaceBlocks(
          projectId,
          versionRef.current,
          blocksToSend
        )
        versionRef.current = response.version
        previousRef.current = response.blocks
        savedRef.current = fingerprint
      }
      if (metadataToSend !== null) {
        const response = await updateProject(projectId, {
          ...metadataToSend,
          version: versionRef.current,
        })
        versionRef.current = response.version
        /* Ueber einen Ref: der Aufrufer reicht hier gewoehnlich eine bei
           jedem Rendern neue Funktion herein, und stuende sie in den
           Abhaengigkeiten, entstuende der Takt dauernd neu. */
        onMetadataSavedRef.current(response)
      }
      setError(null)
      setState("saved")
      return true
    } catch (saveError) {
      if (!isApiError(saveError)) {
        throw saveError
      }
      setError(saveError)
      if (saveError.errorCode === "PROJECT_VERSION_CONFLICT") {
        /* Kein zweiter Versuch, und auch kein weiterer Takt: jeder
           folgende traefe denselben Konflikt (§6.4). */
        stoppedRef.current = true
        setState("conflict")
      } else if (saveError.errorCode === "PROJECT_LOCKED_BY_OTHER") {
        /*
         * Die Sperre ist an jemand anders uebergegangen (§6.9), etwa weil
         * dieser Tab lange im Hintergrund lag und der Herzschlag ausblieb.
         * Auch hier kein weiterer Takt: er traefe dieselbe Wand, und zwar
         * bei jedem Tastendruck. Der Zustand bleibt sichtbar, der Text
         * steht weiter da, und das Gatter legt seinen Hinweis darueber.
         */
        stoppedRef.current = true
        setState("error")
      } else {
        setState("error")
      }
      return false
    }
  }, [enabled, projectId, readDocument, readMetadata])

  const run = useCallback((): Promise<boolean> => {
    if (runningRef.current !== null) {
      /* Waehrend eines Laufs wird nur gemerkt, dass danach noch einmal
         gesendet werden muss. */
      againRef.current = true
      return runningRef.current
    }
    /*
     * Als Schleife und nicht als Rekursion: „waehrenddessen kam noch etwas
     * dazu" kann beliebig oft eintreten, und ein Aufruf, der sich selbst
     * aus seinem eigenen finally heraus startet, waechst mit jeder Runde um
     * eine Ebene im Stapel.
     */
    const execute = async (): Promise<boolean> => {
      /* Ab hier ist der offene Stand unterwegs; die Obergrenze zaehlt erst
         wieder ab der naechsten Aenderung. */
      pendingSinceRef.current = null
      let result = await save()
      while (againRef.current && !stoppedRef.current) {
        againRef.current = false
        result = await save()
      }
      return result
    }
    const running = execute().finally(() => {
      runningRef.current = null
    })
    runningRef.current = running
    return running
  }, [save])

  const schedule = useCallback(() => {
    /*
     * Ohne {@code enabled}: die Kopfangaben duerfen auch dann geschrieben
     * werden, wenn die Schreibflaeche gesperrt ist, etwa weil ein Block
     * nicht gelesen werden konnte. Ob wirklich etwas hinausgeht,
     * entscheidet {@code save()}.
     */
    if (stoppedRef.current) {
      return
    }
    setState((current) => (current === "saving" ? current : "pending"))
    const now = Date.now()
    pendingSinceRef.current ??= now
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }
    /*
     * Die Entprellung wird gekuerzt, sobald sie die Obergrenze
     * ueberschreiten wuerde. Ein zweiter, parallel laufender Wecker fuer die
     * Obergrenze waere die naheliegende, aber schlechtere Loesung: zwei
     * Wecker koennen dicht hintereinander feuern, und dann liegt genau der
     * Fall vor, den {@code run()} verhindern soll.
     */
    const untilDeadline = Math.max(
      0,
      pendingSinceRef.current + MAX_WAIT_MS - now
    )
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null
        void run()
      },
      Math.min(DEBOUNCE_MS, untilDeadline)
    )
  }, [run])

  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (stoppedRef.current) {
      return false
    }
    /* Nichts zu speichern ist kein Fehlschlag: {@code save()} meldet dann
       von selbst {@code true}, ohne einen Request abzusetzen. */
    return run()
  }, [run])

  /*
   * Ein offener Takt wird beim Abraeumen noch angestossen. Ob er den Server
   * erreicht, haengt daran, ob die Schreibflaeche zu diesem Zeitpunkt noch
   * steht; darauf verlaesst sich niemand. Die Wege aus der Seite heraus
   * (Zurueck, Vorschau, Einreichen) rufen vorher ausdruecklich flush() und
   * warten dessen Ergebnis ab.
   *
   * <p><strong>Ohne Abhaengigkeiten, und {@code run} kommt ueber einen
   * Ref.</strong> Stuende {@code run} in der Liste, liefe die
   * Aufraeumfunktion bei jedem Identitaetswechsel von {@code run} und
   * schickte den offenen Stand sofort los, statt ihn entprellt abzuwarten.
   * {@code run} haengt ueber {@code save} an {@code readDocument}, und ein
   * Aufrufer, der es nicht in {@code useCallback} fuehrt, reichte bei jedem
   * Rendern eine neue Funktion herein: aus der Entprellung wuerde dann
   * stillschweigend ein Request je Tastendruck. Die Seite fuehrt
   * {@code readDocument} stabil, aber darauf darf sich der Takt nicht
   * verlassen (aufgefallen beim Test zur Obergrenze).
   */
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        void runRef.current()
      }
    }
  }, [])

  return { state, error, schedule, flush }
}
