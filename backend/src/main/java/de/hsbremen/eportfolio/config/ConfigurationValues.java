package de.hsbremen.eportfolio.config;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Gemeinsame Pruefung der Pflichtwerte aus der Umgebung (API-Contract §6.8).
 *
 * <p><strong>Warum es diese Klasse gibt.</strong> Ein Platzhalter ohne Default
 * in {@code application-prod.yml} ist <em>kein</em> Fail-Fast-Netz. Springs
 * {@code Binder} loest Platzhalter mit
 * {@code ignoreUnresolvablePlaceholders = true} auf: fehlt die
 * Umgebungsvariable, scheitert die Bindung nicht, sondern der Zieltyp bekommt
 * die Zeichenfolge {@code ${AZURE_STORAGE_CONTAINER}} als Wert. Ohne diese
 * Pruefung startet die Anwendung also fehlerfrei und arbeitet gegen einen
 * Container, der so heisst wie der Platzhalter. Ein
 * {@code @NotBlank} sieht das nicht: die Zeichenfolge ist nicht leer.
 *
 * <p>Das ist genau der Fehler, den §6.5 und §6.8 ausschliessen wollen, nur
 * schlimmer als der offene Fall: statt beim Start zu scheitern, laeuft die
 * Anwendung scheinbar normal und faellt erst beim ersten Upload auf.
 */
final class ConfigurationValues {

	/**
	 * Ein nicht aufgeloester Platzhalter, auch mitten im Wert. Absichtlich
	 * {@code find()} und nicht {@code matches()}: bei
	 * {@code https://${APP_HOST}/portfolio} ist genauso wenig brauchbar.
	 */
	private static final Pattern UNRESOLVED_PLACEHOLDER = Pattern.compile("\\$\\{[^{}]*}");

	private ConfigurationValues() {
	}

	/**
	 * Ob ein Konfigurationswert fehlt: nicht gesetzt, leer, oder ein
	 * Platzhalter, den niemand aufgeloest hat.
	 */
	static boolean isMissing(String value) {
		return value == null || value.isBlank() || UNRESOLVED_PLACEHOLDER.matcher(value).find();
	}

	/**
	 * Bricht den Start ab und nennt jeden fehlenden Schluessel.
	 *
	 * <p>Die Meldung enthaelt ausschliesslich Schluesselnamen, niemals einen
	 * vorhandenen Wert: sie landet im Startprotokoll und damit womoeglich in
	 * einem CI-Log.
	 *
	 * @param context     was nicht konfiguriert ist, in einem Halbsatz
	 * @param missingKeys Schluessel in der Form
	 *                    {@code app.storage.container (AZURE_STORAGE_CONTAINER)}
	 */
	static void failIfMissing(String context, List<String> missingKeys) {
		if (missingKeys.isEmpty()) {
			return;
		}
		throw new IllegalStateException(
				"%s, aber diese Pflichtwerte fehlen: %s. Sie kommen aus der Umgebung, Vorlage: .env.example"
						.formatted(context, String.join(", ", missingKeys)));
	}
}
