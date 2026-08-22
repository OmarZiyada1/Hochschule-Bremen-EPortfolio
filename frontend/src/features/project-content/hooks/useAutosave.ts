import { useCallback, useEffect, useRef, useState } from "react"

import { replaceBlocks } from "@/api/queries/blocks"
import { isApiError, type ApiError } from "@/api/errors"
import {
  docToBlocks,
  type PreviousBlock,
} from "@/features/project-content/blockSerialization"
import type { ProjectDocument } from "@/features/project-content/blockTypes"

/**
 * Der Speichertakt des Editors (Contract 6.1, 6.4).
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
  readDocument,
}: {
  projectId: string
  /** Falsch heisst: nicht speichern (read-only Status oder Loecher im Bestand). */
  enabled: boolean
  /** Version aus dem letzten Lesen; danach fuehrt der Hook sie selbst. */
  version: number
  /** Blockliste aus dem letzten Lesen, fuer die stabilen IDs. */
  blocks: readonly PreviousBlock[]
  /** Liefert den aktuellen Stand der Schreibflaeche. */
  readDocument: () => ProjectDocument | null
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
    savedRef.current = null
    stoppedRef.current = false
    pendingSinceRef.current = null
  }, [version])

  const save = useCallback(async (): Promise<boolean> => {
    const document = readDocument()
    if (document === null || !enabled || stoppedRef.current) {
      return false
    }

    const payload = docToBlocks(document, previousRef.current)
    const fingerprint = JSON.stringify(payload)
    if (fingerprint === savedRef.current) {
      setState("saved")
      return true
    }

    setState("saving")
    try {
      const response = await replaceBlocks(
        projectId,
        versionRef.current,
        payload
      )
      versionRef.current = response.version
      previousRef.current = response.blocks
      savedRef.current = fingerprint
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
      } else {
        setState("error")
      }
      return false
    }
  }, [enabled, projectId, readDocument])

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
    if (!enabled || stoppedRef.current) {
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
  }, [enabled, run])

  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!enabled || stoppedRef.current) {
      /* Nichts zu speichern ist kein Fehlschlag: eine read-only Flaeche hat
         keinen offenen Stand. */
      return !stoppedRef.current
    }
    return run()
  }, [enabled, run])

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
