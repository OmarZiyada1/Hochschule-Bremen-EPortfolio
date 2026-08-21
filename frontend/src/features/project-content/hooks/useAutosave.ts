import { useCallback, useEffect, useRef, useState } from "react"

import { isApiError, type ApiError } from "@/api/errors"
import { replaceBlocks } from "@/api/queries/blocks"
import type { BlocksResponse } from "@/api/types"
import {
  docToBlocks,
  type PreviousBlock,
} from "@/features/project-content/blockSerialization"
import type { ProjectDocument } from "@/features/project-content/blockTypes"

/**
 * Der Speichertakt des Editors: entprellt, immer nur einer gleichzeitig,
 * und mit sichtbarem Zustand (Contract 6.1, 6.4).
 *
 * <p><strong>Vier Zusagen, und jede hat ihren Grund.</strong>
 *
 * <ol>
 *   <li><strong>Entprellt.</strong> Bei jedem Tastenanschlag zu senden
 *   erzeugte eine Anfrage je Zeichen und mit ihr eine neue
 *   {@code Project.version}; das Optimistic Locking aus 6.4 liefe damit
 *   staendig gegen sich selbst.</li>
 *   <li><strong>Nur einer gleichzeitig.</strong> Zwei ueberlappende Takte
 *   erzeugen zuverlaessig einen Versionskonflikt gegen die eigene Sitzung:
 *   der zweite tritt mit der Version an, die der erste gerade erhoeht. Ein
 *   laufender Takt setzt deshalb ein Flag, und die Aenderungen waehrend
 *   seiner Laufzeit gehen im naechsten mit.</li>
 *   <li><strong>{@code version} und IDs kommen aus der Antwort.</strong>
 *   Ohne die IDs schickt der naechste Takt dieselben Bloecke wieder ohne
 *   {@code id}, der Server legt sie neu an, und blockbezogene Kommentare
 *   waeren dauerhaft unmoeglich. Der Client zaehlt die Version nie selbst
 *   hoch.</li>
 *   <li><strong>409 wird nie automatisch wiederholt</strong>
 *   (Frontend-Regel 4, 6.4). Ein zweiter Versuch mit der frischen Version
 *   ueberschriebe genau die fremde Aenderung, vor der das Locking schuetzt.
 *   Der Takt haelt an und ueberlaesst die Entscheidung der Person.</li>
 * </ol>
 *
 * <p><strong>Ein stiller Fehlschlag ist Datenverlust mit Ansage.</strong>
 * Deshalb traegt jeder Zustand eine sichtbare Entsprechung
 * ({@code AutosaveStatus} mit {@code role="status"}), und deshalb meldet
 * dieser Hook den Fehler, statt ihn zu verschlucken.
 */

/** Wartezeit nach der letzten Aenderung, bevor gesendet wird. */
const DEBOUNCE_MS = 1500

/**
 * Die Zustaende des Speichertakts.
 *
 * <p>{@code idle} heisst „seit dem Laden nichts geaendert" und zeigt nichts
 * an; erst ab der ersten Aenderung gibt es etwas zu melden.
 * {@code conflict} ist bewusst kein {@code error}: er verlangt eine
 * Entscheidung und nicht bloss einen weiteren Versuch.
 */
export type AutosaveState =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error"
  | "conflict"

/**
 * Wie ein {@link Autosave.flush} ausgegangen ist.
 *
 * <p>{@code saved} heisst „nichts steht mehr aus". {@code conflict}
 * unterscheidet den Fall, in dem eine Entscheidung ansteht, von dem, in dem
 * ein weiterer Versuch hilft.
 */
export type FlushResult = { saved: boolean; conflict: boolean }

export type Autosave = {
  state: AutosaveState
  /** Der Fehler des letzten Fehlschlags, fuer die Meldung an der Seite. */
  error: ApiError | null
  /**
   * Es gibt Aenderungen, die noch nicht beim Server sind.
   *
   * <p>Auch nach einem Fehlschlag: dort ist der Verlust sogar
   * wahrscheinlicher als im Normalfall, weil der letzte Speichervorgang
   * gerade misslungen ist.
   */
  hasUnsavedChanges: boolean
  /** Nach einer Aenderung im Dokument aufrufen. */
  schedule: () => void
  /**
   * Sofort senden, ohne auf die Entprellung zu warten, und melden, wie es
   * ausgegangen ist.
   *
   * <p><strong>Das Ergebnis ist kein Beiwerk.</strong> Der Aufrufer reicht
   * danach den Statuswechsel ein, und dafuer muss er wissen, ob wirklich
   * alles beim Server ist. Ueber den Zustand ginge das nicht: der kommt
   * ueber {@code setState} und steht nach dem Warten noch nicht im Rendern
   * des Aufrufers.
   */
  flush: () => Promise<FlushResult>
  /** Nach dem Neuladen im Konfliktfall: Version und IDs neu setzen. */
  reset: (response: { version: number; blocks: PreviousBlock[] }) => void
}

export function useAutosave({
  projectId,
  enabled,
  version,
  blocks,
  readDocument,
}: {
  projectId: string
  /**
   * Ob ueberhaupt gespeichert werden darf. Falsch, solange der Status die
   * Inhaltsbearbeitung sperrt (4.1) oder {@code dropped} nicht leer ist:
   * der PUT ersetzt die Liste vollstaendig und loeschte die Bloecke, die
   * der Client nicht lesen konnte.
   */
  enabled: boolean
  /** Stand aus der letzten Antwort (6.4). */
  version: number
  /** IDs und Typen aus der letzten Antwort, fuer den Upsert ueber die Position. */
  blocks: readonly PreviousBlock[]
  /**
   * Liefert das aktuelle Dokument. Als Funktion und nicht als Wert, damit
   * der Hook nicht bei jedem Tastenanschlag neu gerendert wird: der Editor
   * meldet die Aenderung, gelesen wird sie erst beim Senden.
   */
  readDocument: () => ProjectDocument | null
}): Autosave {
  const [state, setState] = useState<AutosaveState>("idle")
  const [error, setError] = useState<ApiError | null>(null)

  const versionRef = useRef(version)
  const previousRef = useRef<readonly PreviousBlock[]>(blocks)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  /* Waehrend eines laufenden Takts eingegangene Aenderungen. Sie gehen im
     naechsten mit, statt einen zweiten Takt daneben zu starten. */
  const dirtyRef = useRef(false)
  /* Nach einem Konflikt wird nicht mehr von selbst gesendet, bis die Person
     entschieden hat. */
  const haltedRef = useRef(false)
  /*
   * Der laufende Takt als Versprechen. {@link Autosave.flush} braucht ihn:
   * ohne ihn kaeme es aus einem Aufruf zurueck, waehrend noch etwas
   * unterwegs ist, und das Einreichen liefe gegen den eigenen Speichervorgang.
   */
  const runningRef = useRef<Promise<void> | null>(null)
  /** Laufende Nummer der Takte, siehe finally in {@link send}. */
  const runCounterRef = useRef(0)

  /* Die zuletzt gesehene Requisite, um eine frisch gelesene Serverfassung
     von einem blossen Rendern zu unterscheiden. */
  const lastPropVersionRef = useRef(version)

  /**
   * Eine <em>frisch gelesene</em> Serverfassung gewinnt gegen den Ref.
   *
   * <p><strong>Erkannt wird sie an der Version</strong>, und das ist der
   * Kern der Sache. Nach dem ersten Takt traegt der Ref die Version aus der
   * Antwort, waehrend die Requisite noch die alte aus der Query traegt: der
   * Takt laedt die Query bewusst nicht neu, weil das die Schreibflaeche
   * unter den Fingern austauschte. Liefe die Zuweisung bei jedem Rendern,
   * fiele der Ref auf die veraltete Version zurueck, und der naechste Takt
   * liefe mit ihr in einen Versionskonflikt gegen die eigene Sitzung.
   *
   * <p>Ueber die Identitaet der Blockliste laesst sich das nicht
   * entscheiden: sie ist je nach Aufrufer bei jedem Rendern ein neues
   * Array. Die Version dagegen wechselt genau dann, wenn wirklich etwas
   * gelesen wurde: beim ersten Eintreffen der Antwort und nach jedem
   * Neuladen.
   */
  useEffect(() => {
    if (lastPropVersionRef.current === version) {
      return
    }
    lastPropVersionRef.current = version
    if (!inFlightRef.current) {
      versionRef.current = version
      previousRef.current = blocks
    }
  }, [version, blocks])

  /**
   * Ein Takt, und danach so lange weitere, wie waehrenddessen geschrieben
   * wurde.
   *
   * <p><strong>Die Schleife ersetzt einen Nachlauf-Aufruf</strong>, und das
   * ist kein Umbau um seiner selbst willen: nur so gibt es <em>ein</em>
   * Versprechen, das den gesamten ausstehenden Stand abdeckt.
   * {@link Autosave.flush} wartet darauf, bevor eingereicht wird. Mit einem
   * Nachlauf-Aufruf haette jeder Durchgang sein eigenes Versprechen, und das
   * Einreichen liefe gegen den zweiten.
   *
   * <p>{@code dirtyRef} wird <strong>vor</strong> dem Warten
   * zurueckgesetzt, damit eine Aenderung waehrend der Anfrage nicht
   * verlorengeht, sondern den naechsten Durchgang ausloest.
   */
  const send = useCallback(async (): Promise<FlushResult> => {
    if (inFlightRef.current) {
      /* Es laeuft schon einer, und der nimmt den frischen Stand mit. */
      dirtyRef.current = true
      await runningRef.current
      return {
        saved: !dirtyRef.current && !haltedRef.current,
        conflict: haltedRef.current,
      }
    }
    if (haltedRef.current) {
      return { saved: false, conflict: true }
    }
    if (!enabled) {
      /* Es gibt nichts zu speichern, weil nichts geschrieben werden darf. */
      return { saved: true, conflict: false }
    }

    inFlightRef.current = true
    /*
     * Eine laufende Nummer statt eines Vergleichs mit dem Versprechen
     * selbst: das finally soll den Ref nur aufraeumen, wenn seither kein
     * neuer Lauf begonnen hat. Endet der Lauf synchron, liefe sein finally
     * sonst vor der Zuweisung unten, und der Ref behauptete danach, es
     * laufe etwas.
     */
    const runId = (runCounterRef.current += 1)
    let outcome: FlushResult = { saved: true, conflict: false }
    const run = (async () => {
      try {
        do {
          const document = readDocument()
          if (document === null || !enabled || haltedRef.current) {
            outcome = {
              saved: !haltedRef.current,
              conflict: haltedRef.current,
            }
            return
          }
          dirtyRef.current = false
          setState("saving")

          try {
            const response: BlocksResponse = await replaceBlocks(projectId, {
              version: versionRef.current,
              blocks: docToBlocks(document, previousRef.current),
            })
            versionRef.current = response.version
            previousRef.current = response.blocks.map((block) => ({
              id: block.id,
              type: block.type,
            }))
            setError(null)
          } catch (caught) {
            const apiError = isApiError(caught) ? caught : null
            setError(apiError)
            if (apiError?.errorCode === "PROJECT_VERSION_CONFLICT") {
              /* Nicht wiederholen (6.4). Der Takt haelt an; weiter geht es
                 erst nach dem Neuladen ueber reset(). */
              haltedRef.current = true
              setState("conflict")
              outcome = { saved: false, conflict: true }
            } else {
              setState("error")
              outcome = { saved: false, conflict: false }
            }
            return
          }
        } while (dirtyRef.current && !haltedRef.current)

        setState("saved")
        outcome = { saved: true, conflict: false }
      } finally {
        inFlightRef.current = false
        if (runCounterRef.current === runId) {
          runningRef.current = null
        }
      }
    })()

    runningRef.current = run
    await run
    return outcome
  }, [enabled, projectId, readDocument])

  const schedule = useCallback(() => {
    if (!enabled || haltedRef.current) {
      return
    }
    dirtyRef.current = true
    setState((current) => (current === "saving" ? current : "pending"))
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void send()
    }, DEBOUNCE_MS)
  }, [enabled, send])

  /**
   * Sofort senden und abwarten, dass nichts mehr aussteht.
   *
   * <p><strong>Auch dann, wenn gerade schon gesendet wird.</strong> Genau
   * daran haengt das Einreichen: {@code EditorPage} ruft {@code flush} und
   * schickt danach den Statuswechsel. Kaeme {@code flush} zurueck, waehrend
   * noch ein Takt unterwegs ist, traefe der Statuswechsel den Server
   * womoeglich vor dem letzten Speichervorgang, und der schluege dann mit
   * 409 {@code PROJECT_STATUS_NOT_EDITABLE} fehl: eingereicht waere ein
   * Stand, den niemand so gesehen hat.
   */
  const flush = useCallback(async (): Promise<FlushResult> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    /*
     * Nichts zu tun heisst nichts zu senden. Ohne diese Schranke schriebe
     * jedes Einreichen die komplette Blockliste neu und erhoehte
     * Project.version ohne fachlichen Anlass (6.4).
     */
    if (!dirtyRef.current && !inFlightRef.current) {
      return { saved: !haltedRef.current, conflict: haltedRef.current }
    }
    return send()
  }, [send])


  const reset = useCallback(
    (response: { version: number; blocks: PreviousBlock[] }) => {
      /* Ein noch offener Zeitgeber schickte sonst gleich nach dem Neuladen
         den verworfenen Stand hinterher. */
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      versionRef.current = response.version
      previousRef.current = response.blocks
      lastPropVersionRef.current = response.version
      haltedRef.current = false
      dirtyRef.current = false
      setError(null)
      setState("idle")
    },
    []
  )

  /* Ein laufender Zeitgeber ueberlebt die Komponente nicht: sonst schickt
     eine verlassene Seite noch einen Takt hinterher. */
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return {
    state,
    error,
    /*
     * "error" zaehlt mit: dirtyRef steht dort weiter auf true, und der
     * bewachte Weg zurueck soll gerade dann fragen. "conflict" zaehlt
     * bewusst nicht mit: der Takt ist angehalten, ein Speichern gaebe es
     * nicht mehr, und ein Dialog mit der Schaltflaeche "Speichern und
     * verlassen" verspraeche etwas, das er nicht halten kann. Diesen Fall
     * traegt der Konfliktdialog, der ausdruecklich sagt, dass die eigene
     * Fassung nicht gespeichert wird.
     */
    hasUnsavedChanges:
      state === "pending" || state === "saving" || state === "error",
    schedule,
    flush,
    reset,
  }
}
