package de.hsbremen.eportfolio.file.dto;

import de.hsbremen.eportfolio.file.StoredFile;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Antwort von {@code POST /api/files} (API-Contract §6.1).
 *
 * <p><strong>Bewusst ohne {@code path}:</strong> der Speicherschluessel
 * verlaesst den Server nie (§3.15.1). Ausgeliefert waere er eine zweite, an
 * der Berechtigungspruefung vorbeifuehrende Zugriffsmoeglichkeit, und der
 * Anbieter bliebe nicht mehr serverseitig austauschbar. Der Client kennt
 * ausschliesslich {@code url}.
 *
 * @param id       technischer Schluessel der Datei
 * @param fileName Originalname aus dem Upload, reine Anzeigeinformation
 * @param mimeType gepruefter MIME-Typ aus der Allowlist (§3.15)
 * @param size     Groesse in Bytes
 * @param url      der einzige Weg zur Datei
 */
public record StoredFileResponse(
		UUID id,

		String fileName,

		String mimeType,

		long size,

		@Schema(description = "Relativer Abrufpfad /api/files/{id}. Es gibt keine zweite "
				+ "Adresse fuer eine Datei (§3.15.1).")
		String url) {

	public static StoredFileResponse from(StoredFile file) {
		return new StoredFileResponse(
				file.getId(),
				file.getFileName(),
				file.getMimeType(),
				file.getSize(),
				"/api/files/" + file.getId());
	}
}
