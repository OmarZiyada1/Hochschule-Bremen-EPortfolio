package de.hsbremen.eportfolio.config;

import jakarta.validation.constraints.NotNull;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Konfiguration des Objektspeichers ({@code app.storage}, API-Contract §6.8).
 *
 * <p>Dieser Record legt nur fest, <em>welcher</em> Adapter mit <em>welchen</em>
 * Zugangsdaten arbeitet. Der Port {@code FileStorage} und seine beiden
 * Implementierungen entstehen in KAN-23; ein Interface ohne Aufrufer waere hier
 * nicht pruefbar.
 *
 * <p><strong>Zugangsdaten kommen ausschliesslich aus der Umgebung.</strong>
 * In {@code application-prod.yml} stehen nur Platzhalter ohne Default, also
 * {@code ${AZURE_STORAGE_CONNECTION_STRING}} und nicht
 * {@code ${AZURE_STORAGE_CONNECTION_STRING:irgendetwas}}. Fehlt der Wert,
 * scheitert schon die Aufloesung des Platzhalters. Dass in den eingecheckten
 * yml-Dateien nichts steht, was wie ein Schluessel aussieht, haelt
 * {@code NoSecretsInConfigurationTest} fest.
 *
 * <p><strong>Warum die Azure-Werte nicht einfach {@code @NotBlank} tragen.</strong>
 * Sie sind nur bei {@link StorageProvider#AZURE} Pflicht. Trueg jedes Feld die
 * Annotation, muessten im dev-Profil Platzhalterwerte in der eingecheckten
 * {@code application-dev.yml} stehen, die von echten Zugangsdaten nicht zu
 * unterscheiden waeren. Stattdessen prueft {@link #requireAzureCredentials} erst
 * nach der Bindung und nennt jeden fehlenden Schluessel beim Namen.
 *
 * @param provider         Aktiver Adapter. Ohne Wert startet die Anwendung
 *                         nicht; ein stiller Rueckfall ist nicht vorgesehen
 *                         (§6.8).
 * @param container        Name des Blob-Containers, Pflicht bei
 *                         {@code provider=azure}. Entspricht dem Bucket eines
 *                         S3-Speichers.
 * @param connectionString Verbindungszeichenfolge des Speicherkontos, Pflicht
 *                         bei {@code provider=azure}. Enthaelt Endpoint,
 *                         Kontoname und Kontoschluessel in einem Wert; deshalb
 *                         ist sie ein Geheimnis und darf weder in eine Response
 *                         noch ins Log geraten.
 * @param publicBaseUrl    Optional und heute bewusst leer. §3.15.1 laesst
 *                         Dateien ausschliesslich ueber
 *                         {@code GET /api/files/{id}} ausliefern, weil die
 *                         Sichtbarkeit am Projektstatus haengt und eine
 *                         oeffentliche Objekt-URL diesen Zustand nicht kennt.
 *                         Das Feld ist der vorbereitete Platz fuer den dort als
 *                         Ausblick genannten Weg ueber kurzlebige signierte
 *                         URLs, nicht fuer einen oeffentlichen Container.
 * @param localDirectory   Ablageort des Local-Adapters, Default
 *                         {@code var/storage} unterhalb des Arbeitsverzeichnisses.
 */
@Validated
@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(
		@NotNull StorageProvider provider,
		String container,
		String connectionString,
		String publicBaseUrl,
		Path localDirectory) {

	public StorageProperties {
		if (localDirectory == null) {
			localDirectory = Path.of("var", "storage");
		}
		requireAzureCredentials(provider, container, connectionString);
	}

	/**
	 * Bricht den Start ab, wenn bei {@code provider=azure} ein Pflichtwert fehlt.
	 *
	 * <p>Gesammelt statt beim ersten Treffer abgebrochen: wer eine frische
	 * Umgebung aufsetzt, hat in aller Regel <em>beide</em> Werte noch nicht
	 * gesetzt und soll das in einem Durchgang sehen und nicht in zwei
	 * fehlgeschlagenen Starts.
	 *
	 * <p>„Fehlt" schliesst den nicht aufgeloesten Platzhalter ein, siehe
	 * {@link ConfigurationValues#isMissing(String)}. Ohne diesen Fall hiesse der
	 * Container im Betrieb {@code ${AZURE_STORAGE_CONTAINER}} und die Anwendung
	 * kaeme fehlerfrei hoch.
	 *
	 * <p>Die Meldung nennt den Property-Schluessel und die zugehoerige
	 * Umgebungsvariable, niemals den vorhandenen Teil eines Wertes.
	 */
	private static void requireAzureCredentials(StorageProvider provider, String container, String connectionString) {
		// provider == null meldet bereits @NotNull; hier waere die Meldung nur
		// eine zweite, verwirrende Fehlerspur.
		if (provider != StorageProvider.AZURE) {
			return;
		}

		List<String> missing = new ArrayList<>();
		if (ConfigurationValues.isMissing(container)) {
			missing.add("app.storage.container (AZURE_STORAGE_CONTAINER)");
		}
		if (ConfigurationValues.isMissing(connectionString)) {
			missing.add("app.storage.connection-string (AZURE_STORAGE_CONNECTION_STRING)");
		}

		ConfigurationValues.failIfMissing("app.storage.provider=azure", missing);
	}
}
