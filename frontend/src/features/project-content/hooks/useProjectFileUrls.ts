import { useQueries } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef } from "react"

import { apiPaths } from "@/api/endpoints"
import { fileQueries } from "@/api/queries/files"

/**
 * Loest Datei-IDs eines <strong>nicht veroeffentlichten</strong> Projekts in
 * anzeigbare Adressen auf.
 *
 * <p><strong>Warum das noetig ist.</strong> {@code GET /api/files/{id}} ist
 * in {@code SecurityConfig} zwar offen, aber {@code FileService.download}
 * laesst eine projektgebundene Datei nur durch, wenn die anfragende Person
 * das Projekt lesen darf (5, Zeile „Datei lesen"). Ein
 * {@code <img src="/api/files/…">} schickt keinen
 * {@code Authorization}-Header: das Token liegt im Store und nicht in einem
 * Cookie. Im Editor eines Entwurfs blieben Bild, Galerie, Video, Ton und
 * Dokument damit stumm leer, ohne Fehler und ohne Meldung. Derselbe Befund
 * wie beim Titelbild in KAN-35, dieselbe Loesung.
 *
 * <p>Die Datei kommt deshalb ueber {@code fileQueries.blob} mit Token, und
 * daraus wird eine Object-URL. Sie lebt so lange wie der Blob und wird beim
 * Wechsel freigegeben; ohne {@code revokeObjectURL} haelt der Browser jede
 * je gezeigte Datei bis zum Neuladen der Seite im Speicher.
 *
 * <p><strong>Solange eine Datei laedt, gibt es keine Adresse.</strong> Die
 * Funktion liefert dann die leere Zeichenkette, und die Verwendungsstelle
 * zeigt einen Platzhalter statt eines {@code src=""}: ein leeres
 * {@code src} laedt in manchen Browsern die Seite selbst noch einmal.
 */
export function useProjectFileUrls(
  fileIds: readonly string[]
): (fileId: string) => string {
  /* Stabile, doppelfreie Reihenfolge: sonst wechselt die Zahl der Queries
     bei jedem Rendern und React beschwert sich ueber die Hook-Reihenfolge. */
  const unique = useMemo(
    () => [...new Set(fileIds)].sort((left, right) => left.localeCompare(right)),
    [fileIds]
  )

  const blobs = useQueries({
    queries: unique.map((fileId) => fileQueries.blob(apiPaths.files.detail(fileId))),
  })

  /*
   * blobs ist bei jedem Rendern ein neues Array, und die Abhaengigkeitsliste
   * eines Hooks muss ein Literal fester Laenge sein. Verglichen wird deshalb
   * ueber eine Kennung, die sich genau dann aendert, wenn eine Datei fertig
   * geladen ist: die IDs derjenigen, zu denen ein Blob vorliegt.
   */
  const loadedKey = unique
    .filter((_, index) => blobs[index]?.data !== undefined)
    .join("|")

  /** Reine Zuordnung, ohne Seiteneffekt: welche Datei traegt welchen Blob. */
  const blobByFileId = useMemo(() => {
    const entries = new Map<string, Blob>()
    unique.forEach((fileId, index) => {
      const blob = blobs[index]?.data
      if (blob !== undefined) {
        entries.set(fileId, blob)
      }
    })
    return entries
    // eslint-disable-next-line react-hooks/exhaustive-deps -- blobs steckt in loadedKey; als Array waere es bei jedem Rendern neu.
  }, [unique, loadedKey])

  /**
   * Die erzeugten Adressen, nach ihrem Blob abgelegt.
   *
   * <p><strong>Warum ein Ref und keine Ableitung.</strong>
   * {@code URL.createObjectURL} ist ein Seiteneffekt, und ein Seiteneffekt
   * in der Renderphase geht in zwei Faellen schief: unter {@code StrictMode},
   * wo React aufraeumt und erneut aufbaut, und bei einem verworfenen
   * Rendern. Eine Ableitung im {@code useMemo} liefe bei beidem nicht
   * erneut, waehrend die Aufraeumung die Adressen schon freigegeben haette:
   * in der Karte stuenden danach tote {@code blob:}-Adressen, und Bild und
   * Galerie blieben im Editor eines Entwurfs leer, waehrend die
   * Produktionsfassung stimmt (Befund des Frontend-Reviews zu KAN-36).
   *
   * <p>Der Ref loest das, weil die Erzeugung <strong>je Blob genau einmal
   * geschieht und danach zwischengespeichert ist</strong>: ein zweites
   * Rendern bekommt dieselbe Adresse, und nach einer Aufraeumung entsteht
   * beim naechsten Zugriff eine neue. Genau das macht den Aufruf waehrend
   * des Renderns unbedenklich: er ist ohne beobachtbaren Unterschied
   * wiederholbar.
   *
   * <p><strong>Getragene Grenze:</strong> die Adresse einer Datei, die nicht
   * mehr im Dokument steht, wird erst beim Verlassen der Seite freigegeben
   * und nicht schon beim Loeschen ihres Blocks. Die Menge ist durch die Zahl
   * der Dateien einer Sitzung begrenzt.
   */
  const cacheRef = useRef(new Map<Blob, string>())

  useEffect(() => {
    const cache = cacheRef.current
    return () => {
      for (const url of cache.values()) {
        URL.revokeObjectURL(url)
      }
      cache.clear()
    }
  }, [])

  return useCallback(
    (fileId: string) => {
      const blob = blobByFileId.get(fileId)
      if (blob === undefined) {
        return ""
      }
      const cached = cacheRef.current.get(blob)
      if (cached !== undefined) {
        return cached
      }
      const url = URL.createObjectURL(blob)
      cacheRef.current.set(blob, url)
      return url
    },
    [blobByFileId]
  )
}

/**
 * Sammelt alle Datei-IDs eines Dokuments, damit {@link useProjectFileUrls}
 * weiss, was es zu holen gibt.
 *
 * <p>Bewusst ueber die rohe JSON-Form und nicht ueber das Typmodell: die
 * Funktion laeuft auch ueber eine Serverantwort, die die Whitelist noch
 * nicht gesehen hat, und ein Knoten, dessen Form nicht passt, soll hier
 * nichts zum Absturz bringen. Gesucht wird das Attribut {@code fileId} in
 * jeder Tiefe, einschliesslich der Galerieeintraege.
 */
export function collectFileIds(value: unknown, found = new Set<string>()): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectFileIds(entry, found)
    }
    return [...found]
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "fileId" && typeof entry === "string" && entry !== "") {
        found.add(entry)
      } else {
        collectFileIds(entry, found)
      }
    }
  }
  return [...found]
}
