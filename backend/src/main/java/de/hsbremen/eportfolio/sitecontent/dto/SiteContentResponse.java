package de.hsbremen.eportfolio.sitecontent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Antwort von {@code GET /api/site-content} und
 * {@code PUT /api/admin/site-content} (§6.1).
 *
 * <p><strong>Ein Objekt und keine blanke Liste</strong>, anders als bei den
 * Stammdaten. Die Startseite ist eine Ansicht und keine Referenzliste; kommt
 * spaeter eine zweite pflegbare Seite dazu, bekommt diese Antwort ein weiteres
 * Feld, waehrend eine blanke Liste dafuer die Aussenform brechen muesste.
 *
 * <p><strong>Nur gepflegte Stellen stehen darin.</strong> Ein Schluessel, zu dem
 * es in keiner Sprache eine Zeile gibt, fehlt ganz; der Client nimmt dort seine
 * i18n-Vorgabe. Die Reihenfolge ist die der Abschnitte auf der Seite.
 *
 * <p>Ohne {@code PageResponse}-Umschlag: es sind hoechstens fuenfzehn Eintraege,
 * und die Startseite braucht sie alle auf einmal (§6.6 verlangt Paginierung nur
 * fuer Listen, die wachsen).
 *
 * @param entries die gepflegten Textstellen, in der Reihenfolge der Abschnitte
 */
public record SiteContentResponse(

		@Schema(description = "Die gepflegten Textstellen. Ein Schluessel erscheint, sobald "
				+ "mindestens eine Sprache gepflegt ist; ungepflegte Schluessel fehlen ganz.")
		List<SiteContentEntryResponse> entries) {
}
