package de.hsbremen.eportfolio.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.fail;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobContainerClientBuilder;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Round-Trip des Azure-Adapters gegen Azurite (KAN-23): derselbe Ablauf wie
 * im {@code LocalFileStorageTest}, aber gegen einen echten Blob-Dienst, ohne
 * Zugangsdaten und ohne Speicherkonto.
 *
 * <p>Wie bei der Datenbank setzt {@code ./mvnw test} voraus, dass die
 * DEV-Betriebsart laeuft ({@code docker compose -f compose.base.yml -f
 * compose.dev.yml up -d}); sie bringt den Dienst {@code azurite} mit.
 *
 * <p><strong>Der Azurite-Entwicklungsschluessel steht hier im
 * Testquelltext</strong> und nicht in einer {@code application*.yml} unter
 * {@code src/main/resources}: er ist von Microsoft veroeffentlicht und damit
 * kein Geheimnis, sieht aber aus wie eines. In einer der geprueften Dateien
 * wuerde er {@code NoSecretsInConfigurationTest} entwerten. Die
 * Verbindungszeichenfolge kommt deshalb ueber {@code @DynamicPropertySource}
 * in den Kontext.
 *
 *
 * <p><strong>{@code @DirtiesContext} gibt die Verbindungen wieder frei</strong>,
 * aus demselben Grund wie in {@code FileUploadLimitTest}: der eigene Kontext
 * dieser Klasse bliebe sonst samt Verbindungspool bis zum Ende des Laufs im
 * Cache stehen (KAN-72).
 *
 * <p>Der Kontext startet mit {@code app.storage.provider=azure} und beweist
 * damit zugleich die Auswahl ueber {@code @ConditionalOnProperty} (§6.8).
 */
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AzureBlobFileStorageTest {

	/** Das dokumentierte Entwicklungskonto von Azurite, kein Geheimnis. */
	private static final String ACCOUNT_NAME = "devstoreaccount1";

	private static final String ACCOUNT_KEY =
			"Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

	private static final String CONTAINER = "kan23-adaptertest";

	@Autowired
	private FileStorage storage;

	/**
	 * Der Port kommt aus der Umgebungsvariable {@code AZURITE_BLOB_PORT}
	 * (Default 10000, siehe {@code .env.example}). Wer ihn in der {@code .env}
	 * umbiegt, setzt ihn fuer den Testlauf auch als Umgebungsvariable; die
	 * {@code .env} selbst liest nur Docker Compose und die Anwendung, nicht
	 * die Testklasse.
	 */
	private static String connectionString() {
		String port = System.getenv().getOrDefault("AZURITE_BLOB_PORT", "10000");
		return "DefaultEndpointsProtocol=http;AccountName=" + ACCOUNT_NAME
				+ ";AccountKey=" + ACCOUNT_KEY
				+ ";BlobEndpoint=http://127.0.0.1:" + port + "/" + ACCOUNT_NAME + ";";
	}

	@DynamicPropertySource
	static void azureStorage(DynamicPropertyRegistry registry) {
		registry.add("app.storage.provider", () -> "azure");
		registry.add("app.storage.container", () -> CONTAINER);
		registry.add("app.storage.connection-string", AzureBlobFileStorageTest::connectionString);
	}

	/**
	 * Legt den Testcontainer an, bevor der erste Round-Trip laeuft. Der
	 * Adapter selbst legt bewusst keinen an; im Test uebernimmt das dieselbe
	 * Rolle, die im Betrieb das Aufsetzen der Umgebung hat.
	 */
	@BeforeAll
	static void createContainer() {
		try {
			new BlobContainerClientBuilder()
					.connectionString(connectionString())
					.containerName(CONTAINER)
					.buildClient()
					.createIfNotExists();
		} catch (Exception e) {
			fail("Azurite ist nicht erreichbar. Die DEV-Betriebsart starten: "
					+ "docker compose -f compose.base.yml -f compose.dev.yml up -d "
					+ "(Ursache: " + e.getMessage() + ")");
		}
	}

	@Test
	@DisplayName("Aktiv ist der Azure-Adapter, nicht der Local-Adapter")
	void azureAdapterIsSelected() {
		assertThat(storage).isInstanceOf(AzureBlobFileStorage.class);
	}

	@ParameterizedTest
	@EnumSource(AllowedFileType.class)
	@DisplayName("Round-Trip je erlaubtem Typ: store, load, delete, load scheitert")
	void roundTrip(AllowedFileType type) throws IOException {
		byte[] content = TestFiles.sample(type);
		String key = "projects/" + UUID.randomUUID() + "/" + UUID.randomUUID();

		storage.store(key, new ByteArrayInputStream(content), content.length, type.mimeType());

		try (InputStream loaded = storage.load(key)) {
			assertThat(loaded.readAllBytes()).isEqualTo(content);
		}
		assertThat(blobContainer().getBlobClient(key).getProperties().getContentType())
				.isEqualTo(type.mimeType());

		storage.delete(key);

		assertThatThrownBy(() -> storage.load(key))
				.isInstanceOf(FileStorageException.class);
	}

	/**
	 * Der Bereichsabruf liefert genau den angeforderten Ausschnitt (§3.15,
	 * KAN-72). Geprueft werden Anfang, Mitte, das Dateiende und die kuerzeste
	 * moegliche Laenge: das Dateiende ist die Stelle, an der eine um eins
	 * verrechnete Grenze zuerst auffiele.
	 */
	@Test
	@DisplayName("Bereichsabruf liefert genau die angeforderten Bytes, auch am Dateiende")
	void rangeLoad() throws IOException {
		byte[] content = TestFiles.sample(AllowedFileType.PNG, 512);
		String key = "projects/" + UUID.randomUUID() + "/" + UUID.randomUUID();
		storage.store(key, new ByteArrayInputStream(content), content.length, "image/png");

		assertRange(key, content, 0, 100);
		assertRange(key, content, 100, 200);
		assertRange(key, content, content.length - 10, 10);
		assertRange(key, content, content.length - 1, 1);
		assertRange(key, content, 0, content.length);

		storage.delete(key);
	}

	private void assertRange(String key, byte[] content, int offset, int length)
			throws IOException {
		byte[] expected = Arrays.copyOfRange(content, offset, offset + length);
		try (InputStream loaded = storage.load(key, offset, length)) {
			assertThat(loaded.readAllBytes())
					.as("Bereich %d bis %d", offset, offset + length - 1)
					.isEqualTo(expected);
		}
	}

	@Test
	@DisplayName("Loeschen eines fehlenden Objekts ist kein Fehler")
	void deleteIsIdempotent() {
		assertThatCode(() -> storage.delete("avatars/" + UUID.randomUUID()))
				.doesNotThrowAnyException();
	}

	private BlobContainerClient blobContainer() {
		return new BlobContainerClientBuilder()
				.connectionString(connectionString())
				.containerName(CONTAINER)
				.buildClient();
	}
}
