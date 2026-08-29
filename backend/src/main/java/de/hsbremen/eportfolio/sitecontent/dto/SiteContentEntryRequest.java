package de.hsbremen.eportfolio.sitecontent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Eine zu pflegende Textstelle im Body von
 * {@code PUT /api/admin/site-content} (§6.1, §3.21).
 *
 * <p><strong>Beide Sprachen zusammen, und beide werden ersetzt.</strong> Was in
 * {@code valueDe} und {@code valueEn} steht, ist danach der Stand dieser Stelle;
 * ein weggelassenes Feld ist kein "bleibt wie es war", sondern dasselbe wie ein
 * leeres. Das ist der Grund, warum die Pflegemaske immer beide Felder schickt:
 * ein PATCH-artiges Verhalten waere hier gefaehrlicher als bequem, weil man der
 * Antwort nicht ansieht, welche Sprache gerade unbeabsichtigt stehen blieb.
 *
 * <p><strong>Leer loescht.</strong> Ein leerer oder nur aus Leerzeichen
 * bestehender Wert entfernt die Zeile dieser Sprache, und die Stelle faellt
 * damit auf die i18n-Vorgabe des Frontends zurueck. Es gibt deshalb keinen
 * anderen Weg, eine Pflege wieder zurueckzunehmen, und es braucht auch keinen:
 * ein eigenes DELETE je Schluessel und Sprache waere derselbe Vorgang mit
 * zweiter Aussenform.
 *
 * <p><strong>Auch der Schluessel hat eine obere Schranke</strong>, nicht nur die
 * beiden Werte. Ein unbekannter Schluessel wird im Fehlertext woertlich
 * gespiegelt, damit die Pflegemaske zeigen kann, welcher gemeint war; ohne
 * Schranke stuende dort, was der Aufrufer geschickt hat, in beliebiger Laenge.
 * 128 Zeichen liegen weit ueber dem laengsten wirklichen Schluessel
 * ({@code home.cta.statFaculties} hat 22) und weit unter dem, was ein
 * Fehler-Envelope tragen soll.
 *
 * @param key     der i18n-Schluessel der Stelle; ein der Startseite unbekannter
 *                ergibt 400 {@code VALIDATION_FAILED}
 * @param valueDe der deutsche Text; leer oder {@code null} loescht ihn
 * @param valueEn der englische Text; leer oder {@code null} loescht ihn
 */
public record SiteContentEntryRequest(

		@Schema(description = "i18n-Schluessel der Textstelle, genau wie im GET. Ein unbekannter "
				+ "Schluessel ergibt 400 VALIDATION_FAILED.", example = "home.hero.subtitle")
		@NotBlank(message = "Schluessel fehlt.")
		@Size(max = 128, message = "Schluessel ist zu lang (hoechstens 128 Zeichen).")
		String key,

		@Schema(description = "Deutscher Text. Leer oder fehlend loescht die deutsche Fassung; "
				+ "die Stelle faellt dann auf die Vorgabe des Frontends zurueck.",
				nullable = true)
		@Size(max = 1000, message = "Deutscher Text ist zu lang (hoechstens 1000 Zeichen).")
		String valueDe,

		@Schema(description = "Englischer Text. Leer oder fehlend loescht die englische Fassung; "
				+ "die Stelle faellt dann auf die Vorgabe des Frontends zurueck.",
				nullable = true)
		@Size(max = 1000, message = "Englischer Text ist zu lang (hoechstens 1000 Zeichen).")
		String valueEn) {
}
