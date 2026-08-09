/**
 * Feature Datei: hochgeladene Medien und ihre Ablage in einem Objektspeicher
 * (API-Contract §3.15, §3.15.1, §6.8).
 *
 * <p>Das Paket ist wie {@code mail} geschnitten: der Port {@code FileStorage}
 * mit zwei Adaptern dahinter ({@code LocalFileStorage},
 * {@code AzureBlobFileStorage}, ausgewaehlt ueber {@code app.storage.provider})
 * und daneben der Fachcode aus Entity {@code StoredFile}, {@code FileService}
 * und {@code FileController}.
 *
 * <p><strong>Wer hier hereinschaut und wer nicht.</strong> Aufrufende Stellen
 * und der Client kennen ausschliesslich {@code /api/files/{id}}; der
 * Speicherschluessel in {@code StoredFile.path} verlaesst den Server nie
 * (§3.15.1). Welcher Adapter dahinter arbeitet, sieht der Fachcode nicht:
 * ein Anbieterwechsel ist eine zusaetzliche Adapterklasse in diesem Paket
 * und kein Eingriff in das Fachmodul.
 */
package de.hsbremen.eportfolio.file;
