package de.hsbremen.eportfolio.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.hsbremen.eportfolio.config.StorageProperties;
import de.hsbremen.eportfolio.config.StorageProvider;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Round-Trip des Local-Adapters gegen ein temporaeres Verzeichnis (KAN-23):
 * ablegen, lesen, loeschen, je erlaubtem Typ aus §3.15. Kein Spring-Kontext,
 * der Adapter wird direkt aus {@link StorageProperties} gebaut.
 */
class LocalFileStorageTest {

	@TempDir
	private Path tempDir;

	private LocalFileStorage storage;

	@BeforeEach
	void buildAdapter() {
		storage = new LocalFileStorage(
				new StorageProperties(StorageProvider.LOCAL, null, null, null, tempDir));
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

		storage.delete(key);

		assertThatThrownBy(() -> storage.load(key))
				.isInstanceOf(FileStorageException.class);
	}

	@Test
	@DisplayName("Der Schluessel wird zu Unterverzeichnissen unterhalb der Basis")
	void keyBecomesSubdirectories() {
		String key = "avatars/" + UUID.randomUUID();
		storage.store(key, new ByteArrayInputStream(TestFiles.sample(AllowedFileType.PNG)),
				64, "image/png");

		assertThat(tempDir.resolve(key)).exists();
	}

	@Test
	@DisplayName("Loeschen eines fehlenden Objekts ist kein Fehler")
	void deleteIsIdempotent() {
		assertThatCode(() -> storage.delete("avatars/" + UUID.randomUUID()))
				.doesNotThrowAnyException();
	}

	@Test
	@DisplayName("Ein Schluessel, der aus dem Basisverzeichnis hinausfuehrt, wird abgewiesen")
	void pathTraversalIsRejected() {
		assertThatThrownBy(() -> storage.load("../ausserhalb"))
				.isInstanceOf(FileStorageException.class);
	}
}
