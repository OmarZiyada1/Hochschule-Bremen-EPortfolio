import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

import { isApiError, type ApiError } from "@/api/errors"
import { projectQueries, releaseEditLock } from "@/api/queries/projects"
import type { EditLockHolderResponse } from "@/api/types"

/**
 * Die Bearbeitungssperre einer Editor-Sitzung (§6.9, KAN-86).
 *
 * <p>An einem Projektinhalt schreibt jeweils eine Person. Dieser Hook
 * beansprucht die Sperre, haelt sie mit einem Herzschlag und gibt sie beim
 * Verlassen der Seite wieder frei. Wer sie nicht bekommt, erfaehrt, auf wen
 * zu warten ist.
 *
 * <p><strong>Der Takt laeuft auch dann weiter, wenn jemand anders haelt.</strong>
 * Nur so bemerkt die wartende Seite, dass die Sperre frei geworden ist, und
 * oeffnet von selbst; ohne das muesste die Person raten, wann sie es erneut
 * versuchen soll. Nach einem harten Fehler (403, 404, 409) haelt er dagegen
 * an, denn der bessert sich nicht von selbst.
 *
 * <p><strong>Was hier nicht passiert:</strong> die Sperre wird nicht
 * durchgesetzt. Das tut der Server an den schreibenden Endpoints (§6.1) mit
 * 409 {@code PROJECT_LOCKED_BY_OTHER}. Die Oberflaeche nimmt der Person nur
 * die Ueberraschung, sie ersetzt die Pruefung nicht (§5).
 */

/**
 * Verzoegerung der Freigabe beim Abraeumen.
 *
 * <p><strong>Warum nicht sofort.</strong> Der Weg vom Editor auf die
 * Metadatenseite und zurueck gehoert zu einem Vorgang, die beiden Seiten
 * liegen aber in verschiedenen Zweigen des Routenbaums: die eine haengt am
 * {@code EditorLayout}, die andere am {@code AppLayout}. Beim Wechsel
 * raeumt der eine Hook ab, waehrend der andere gerade beansprucht. Gaebe der
 * erste sofort frei, koennte sein {@code DELETE} nach dem {@code POST} des
 * zweiten ankommen und die frisch beanspruchte Sperre wieder loeschen; die
 * eigene Sitzung sperrte sich dann selbst aus, bis die Frist ablaeuft.
 *
 * <p>Die Verzoegerung ist die kleinste Loesung, die traegt: wird innerhalb
 * dieser Zeit erneut beansprucht, faellt die Freigabe aus. Ein gemeinsamer
 * Elternknoten fuer beide Routen waere die andere, und er hiesse, den
 * Rahmen des Editors umzubauen.
 */
const RELEASE_DELAY_MS = 400

/**
 * Offene, noch nicht ausgefuehrte Freigaben, je Projekt.
 *
 * <p>Modulweit und nicht im Hook: genau darum geht es, den Wechsel zwischen
 * zwei Montierungen zu ueberbruecken. Ein Zustand im Hook waere mit dem
 * ersten von beiden verschwunden.
 */
const pendingReleases = new Map<string, ReturnType<typeof setTimeout>>()

function cancelRelease(projectId: string): void {
  const timer = pendingReleases.get(projectId)
  if (timer !== undefined) {
    clearTimeout(timer)
    pendingReleases.delete(projectId)
  }
}

function scheduleRelease(projectId: string): void {
  cancelRelease(projectId)
  pendingReleases.set(
    projectId,
    setTimeout(() => {
      pendingReleases.delete(projectId)
      /* Ohne Auswertung: beim Verlassen der Seite ist nicht mehr zu
         entscheiden, was ein Fehlschlag bedeuten wuerde, und die Frist aus
         §6.9 traegt den Fall ohnehin. */
      void releaseEditLock(projectId).catch(() => undefined)
    }, RELEASE_DELAY_MS)
  )
}

/**
 * Nur fuer Tests: offene Freigaben verwerfen.
 *
 * <p>Die Zeitgeber leben im Modul und ueberdauern damit das Abraeumen der
 * Testumgebung. Ohne diesen Aufruf feuert die Freigabe eines Falls in den
 * naechsten hinein, wo kein Handler sie erwartet. Vorbild ist
 * {@code resetAuthStoreForTests}.
 */
export function resetEditLockReleasesForTests(): void {
  for (const timer of pendingReleases.values()) {
    clearTimeout(timer)
  }
  pendingReleases.clear()
}

export type EditLock = {
  /**
   * Darf diese Sitzung schreiben? Vor der ersten Antwort {@code false}:
   * genau in diesem Augenblick wuerden zwei Personen gleichzeitig lostippen.
   */
  heldBySelf: boolean
  /** Wer haelt, wenn es jemand anders ist; sonst {@code null}. */
  blockedBy: EditLockHolderResponse | null
  /** Die erste Antwort steht noch aus. */
  pending: boolean
  /** Ein Versuch laeuft gerade; die Oberflaeche zeigt ihn an. */
  retrying: boolean
  /**
   * Die Sperre liess sich nicht beanspruchen, etwa weil es das Projekt nicht
   * gibt (404), die Person nicht zur Projektseite gehoert (403) oder der
   * Status die Bearbeitung nicht mehr zulaesst (409).
   *
   * <p>Das ist kein Sperrfall: die Seite zeigt dann ihren eigenen Zustand,
   * also ihre Fehlermeldung oder die read-only Ansicht. Ueber den Zugang
   * entscheidet ohnehin der Server.
   */
  error: ApiError | null
  /** Sofort erneut versuchen, statt den naechsten Takt abzuwarten. */
  retry: () => void
}

/**
 * @param projectId Projekt, dessen Sperre gehalten werden soll
 */
export function useEditLock(projectId: string): EditLock {
  const query = useQuery({
    ...projectQueries.editLock(projectId),
    enabled: projectId !== "",
  })

  /*
   * Hat diese Montierung die Sperre je gehalten? Nur dann wird beim
   * Abraeumen freigegeben. Wer den Editor lesend geoeffnet hat oder gar
   * nicht drankam, schickte sonst ein DELETE, das allein 403 oder 409
   * einbringt und nichts freigibt, was ihm gehoert.
   */
  const heldRef = useRef(false)
  const heldBySelf = query.data?.heldBySelf === true
  /* Im Effekt und nicht beim Rendern: waehrend des Renderns ist eine
     Ref-Zuweisung eine Nebenwirkung, die React zu Recht beanstandet. */
  useEffect(() => {
    if (heldBySelf) {
      heldRef.current = true
    }
  }, [heldBySelf])

  useEffect(() => {
    if (projectId === "") {
      return
    }
    cancelRelease(projectId)
    return () => {
      if (heldRef.current) {
        scheduleRelease(projectId)
      }
    }
  }, [projectId])

  const data = query.data
  const error = isApiError(query.error) ? query.error : null

  return {
    heldBySelf,
    blockedBy:
      data !== undefined && !data.heldBySelf ? (data.holder ?? null) : null,
    pending: query.isPending && projectId !== "",
    retrying: query.isFetching,
    error,
    retry: () => {
      void query.refetch()
    },
  }
}
