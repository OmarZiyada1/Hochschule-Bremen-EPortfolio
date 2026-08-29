package de.hsbremen.eportfolio.sitecontent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Body von {@code PUT /api/admin/site-content} (§6.1, §3.21).
 *
 * <p><strong>Vollstaendiger Ersatz der uebergebenen Schluessel, nicht der
 * ganzen Tabelle.</strong> Ein Schluessel, der im Body nicht vorkommt, bleibt
 * unberuehrt. Sonst loeschte ein Formular, das nur einen Abschnitt der
 * Startseite bearbeitet, beim Speichern alle uebrigen; und die Pflegemaske
 * muesste bei jedem Speichern den kompletten Stand mitschicken, den sie
 * moeglicherweise gar nicht geladen hat.
 *
 * <p>Ein {@code PUT} und kein {@code PATCH}, weil je Schluessel tatsaechlich
 * ersetzt und nicht zusammengefuehrt wird (§6.3): was im Eintrag steht, ist
 * danach der Stand dieser Stelle in beiden Sprachen.
 *
 * <p>Eine leere Liste ist erlaubt und aendert nichts. Sie ist kein Fehler,
 * sondern das, was ein Formular schickt, an dem niemand etwas geaendert hat.
 *
 * @param entries die zu pflegenden Stellen; derselbe Schluessel darf nur einmal
 *                vorkommen, sonst haengt das Ergebnis an der Reihenfolge im
 *                Body (400 {@code VALIDATION_FAILED})
 */
public record SiteContentUpdateRequest(

		@Schema(description = "Die zu pflegenden Textstellen. Nicht genannte Schluessel bleiben "
				+ "unberuehrt. Jeder Schluessel hoechstens einmal.")
		@NotNull(message = "Die Liste der Eintraege fehlt.")
		@Valid
		List<SiteContentEntryRequest> entries) {
}
