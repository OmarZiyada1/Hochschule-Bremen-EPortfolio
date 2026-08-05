package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Tests der Startzeilen aus API-Contract §6.8: der aktive Adapter ist
 * erkennbar, das Geheimnis bleibt draussen.
 */
class ConfigurationStartupLoggerTest {

	private static final String ACCOUNT_KEY = "cGFzc3dvcnQtZGFzLW5pZW1hbmQtc2VoZW4tZGFyZg==";

	private static final String CONNECTION_STRING =
			"DefaultEndpointsProtocol=https;AccountName=eportfoliohsb;AccountKey=" + ACCOUNT_KEY + ";"
					+ "EndpointSuffix=core.windows.net";

	private static final MailProperties MAIL = new MailProperties(
			MailProvider.LOG, "noreply@eportfolio.invalid", "E-Portfolio Hochschule Bremen",
			"http://localhost:5173");

	private static ConfigurationStartupLogger loggerFor(StorageProperties storage) {
		return new ConfigurationStartupLogger(storage, MAIL);
	}

	private static ConfigurationStartupLogger azureLogger() {
		return loggerFor(new StorageProperties(
				StorageProvider.AZURE, "eportfolio-files", CONNECTION_STRING, null, null));
	}

	@Test
	@DisplayName("Azure-Zeile nennt Speicherkonto und Container")
	void azureLineNamesAccountAndContainer() {
		assertThat(azureLogger().storageLine())
				.contains("Speicher-Adapter=azure")
				.contains("Speicherkonto=eportfoliohsb")
				.contains("Container=eportfolio-files");
	}

	@Test
	@DisplayName("Azure-Zeile enthaelt weder Kontoschluessel noch Verbindungszeichenfolge")
	void azureLineKeepsTheSecret() {
		String line = azureLogger().storageLine();

		assertThat(line)
				.doesNotContain(ACCOUNT_KEY)
				.doesNotContain("AccountKey")
				.doesNotContain(CONNECTION_STRING);
	}

	@Test
	@DisplayName("Unlesbare Verbindungszeichenfolge wird zu 'unbekannt' statt zur Ausgabe des Rohwerts")
	void unparsableConnectionStringStaysQuiet() {
		// Ein Wert in unerwarteter Form ist genau der Fall, in dem eine
		// gutgemeinte Ausgabe "damit man sieht, was ankam" das Geheimnis ins
		// Log traegt.
		String odd = "irgendetwas-ganz-anderes";
		ConfigurationStartupLogger logger = loggerFor(
				new StorageProperties(StorageProvider.AZURE, "eportfolio-files", odd, null, null));

		assertThat(logger.storageLine())
				.contains("Speicherkonto=unbekannt")
				.doesNotContain(odd);
	}

	@Test
	@DisplayName("Local-Zeile nennt das Verzeichnis, und zwar absolut")
	void localLineNamesDirectory() {
		ConfigurationStartupLogger logger = loggerFor(new StorageProperties(
				StorageProvider.LOCAL, null, null, null, Path.of("var", "storage")));

		assertThat(logger.storageLine())
				.contains("Speicher-Adapter=local")
				// Absolut, weil ein relativer Pfad im Log nur zusammen mit dem
				// Arbeitsverzeichnis des Prozesses etwas aussagt.
				.contains(Path.of("var", "storage").toAbsolutePath().toString());
	}

	@Test
	@DisplayName("Mail-Zeile nennt Adapter und Absender")
	void mailLineNamesAdapterAndSender() {
		assertThat(azureLogger().mailLine())
				.contains("Mail-Adapter=log")
				.contains("Absender=noreply@eportfolio.invalid");
	}
}
