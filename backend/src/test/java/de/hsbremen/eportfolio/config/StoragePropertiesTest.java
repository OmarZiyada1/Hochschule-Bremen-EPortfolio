package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Tests der bedingten Pflichtwerte des Objektspeichers (API-Contract §6.8).
 *
 * <p>Geprueft wird der Record selbst und nicht der Spring-Kontext: die
 * Zusicherung ist, dass es eine {@link StorageProperties}-Instanz mit
 * {@code provider=azure} und fehlenden Zugangsdaten gar nicht geben kann. Dass
 * daraus auch ein Startabbruch wird, prueft {@code ConfigurationBindingTest}.
 */
class StoragePropertiesTest {

	private static final String CONNECTION_STRING =
			"DefaultEndpointsProtocol=https;AccountName=eportfolio;AccountKey=streng-geheim;"
					+ "EndpointSuffix=core.windows.net";

	@Test
	@DisplayName("Local braucht keinen einzigen Zugangswert")
	void localNeedsNoCredentials() {
		assertThatCode(() -> new StorageProperties(StorageProvider.LOCAL, null, null, null, null))
				.doesNotThrowAnyException();
	}

	@Test
	@DisplayName("Ohne local-directory greift var/storage")
	void localDirectoryDefault() {
		StorageProperties properties = new StorageProperties(StorageProvider.LOCAL, null, null, null, null);

		assertThat(properties.localDirectory()).isEqualTo(Path.of("var", "storage"));
	}

	@Test
	@DisplayName("Azure ohne Zugangsdaten nennt beide fehlenden Schluessel auf einmal")
	void azureWithoutCredentials() {
		assertThatThrownBy(() -> new StorageProperties(StorageProvider.AZURE, null, null, null, null))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("app.storage.container")
				.hasMessageContaining("AZURE_STORAGE_CONTAINER")
				.hasMessageContaining("app.storage.connection-string")
				.hasMessageContaining("AZURE_STORAGE_CONNECTION_STRING");
	}

	@Test
	@DisplayName("Azure mit leerem Container zaehlt wie ohne Container")
	void azureWithBlankContainer() {
		assertThatThrownBy(() -> new StorageProperties(StorageProvider.AZURE, "   ", CONNECTION_STRING, null, null))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("app.storage.container");
	}

	@Test
	@DisplayName("Die Fehlermeldung traegt den vorhandenen Kontoschluessel nicht mit sich")
	void errorMessageKeepsSecret() {
		// Nur der Container fehlt, die Verbindungszeichenfolge ist da. Genau
		// dann besteht die Gefahr, dass ein "ist doch hilfreich"-Hinweis das
		// Geheimnis in Log und Stacktrace traegt.
		Throwable thrown = catchThrowable(
				() -> new StorageProperties(StorageProvider.AZURE, null, CONNECTION_STRING, null, null));

		assertThat(thrown).isInstanceOf(IllegalStateException.class);
		assertThat(thrown.getMessage())
				.doesNotContain("streng-geheim")
				.doesNotContain("AccountKey");
	}

	@Test
	@DisplayName("Azure mit Container und Verbindungszeichenfolge ist vollstaendig")
	void azureComplete() {
		assertThatCode(() -> new StorageProperties(
				StorageProvider.AZURE, "eportfolio-files", CONNECTION_STRING, null, null))
				.doesNotThrowAnyException();
	}

	@Test
	@DisplayName("Provider null meldet nur @NotNull, nicht zusaetzlich fehlende Azure-Werte")
	void nullProviderStaysQuiet() {
		// Zwei Fehlerspuren fuer dieselbe Ursache waeren beim Lesen des
		// Startprotokolls irrefuehrend.
		assertThatCode(() -> new StorageProperties(null, null, null, null, null))
				.doesNotThrowAnyException();
	}
}
