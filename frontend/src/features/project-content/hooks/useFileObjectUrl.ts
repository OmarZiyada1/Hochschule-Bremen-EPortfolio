import { apiPaths } from "@/api/endpoints"
import { useFileUrl } from "@/api/useFileUrl"

/**
 * Macht eine {@code fileId} aus einem Blockinhalt anzeigbar.
 *
 * <p>Der Editor arbeitet immer an einem Beitrag, der noch nicht
 * veroeffentlicht ist (Inhaltsbearbeitung gibt es nur in {@code DRAFT} und
 * {@code REVISION}, §4.1); die Datei ist dort nie oeffentlich, und der
 * Abruf laeuft deshalb ohne Ausnahme ueber den angemeldeten Weg. Die
 * Begruendung dafuer und den Unterschied zum oeffentlichen Weg fuehrt
 * {@link useFileUrl}; hier steht allein die Uebersetzung von der
 * {@code fileId} des Blockinhalts auf die Referenz aus §3.15.1.
 *
 * @param fileId Datei-ID aus dem Blockinhalt; leer heisst „noch keine"
 */
export function useFileObjectUrl(fileId: string | null | undefined): {
  url: string | null
  isPending: boolean
  isError: boolean
} {
  return useFileUrl(fileId ? apiPaths.files.detail(fileId) : "", true)
}
