package de.hsbremen.eportfolio.file;

import de.hsbremen.eportfolio.config.StorageProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adapter fuer {@code app.storage.provider=local}: Ablage im Dateisystem
 * unter {@code app.storage.local-directory} (API-Contract §6.8).
 *
 * <p>Zweck ist das Entwickeln ohne Fremddienst: {@code docker compose up -d}
 * plus {@code .env} reicht, es braucht kein Speicherkonto. Nur im Profil
 * {@code dev}; der Betrieb laeuft ueber {@link AzureBlobFileStorage}, weil
 * eine Ablage neben der Anwendung die Daten an genau eine Maschine bindet
 * (§3.15.1).
 *
 * <p>Der anbieterneutrale Schluessel ({@code projects/{id}/{uuid}}) wird als
 * relativer Pfad unterhalb des Basisverzeichnisses abgebildet. Die Schraegstriche
 * im Schluessel werden dabei zu Unterverzeichnissen; das ist eine Eigenheit
 * dieses Adapters und steht nirgends in der Datenbank.
 */
@Component
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "local")
public class LocalFileStorage implements FileStorage {

	private final Path baseDirectory;

	public LocalFileStorage(StorageProperties properties) {
		this.baseDirectory = properties.localDirectory().toAbsolutePath().normalize();
	}

	/**
	 * {@code size} und {@code contentType} braucht dieses Ziel nicht: die
	 * Laenge ergibt sich beim Schreiben, und das Dateisystem fuehrt keinen
	 * MIME-Typ am Objekt. Die Signatur des Ports folgt dem Bedarf von Azure.
	 */
	@Override
	public void store(String key, InputStream data, long size, String contentType) {
		Path target = resolve(key);
		try {
			Files.createDirectories(target.getParent());
			Files.copy(data, target);
		} catch (IOException e) {
			throw new FileStorageException("Objekt konnte nicht abgelegt werden: " + key, e);
		}
	}

	@Override
	public InputStream load(String key) {
		try {
			return Files.newInputStream(resolve(key));
		} catch (NoSuchFileException e) {
			throw new FileStorageException("Kein Objekt unter diesem Schluessel: " + key, e);
		} catch (IOException e) {
			throw new FileStorageException("Objekt konnte nicht gelesen werden: " + key, e);
		}
	}

	@Override
	public void delete(String key) {
		try {
			Files.deleteIfExists(resolve(key));
		} catch (IOException e) {
			throw new FileStorageException("Objekt konnte nicht geloescht werden: " + key, e);
		}
	}

	/**
	 * Bildet den Schluessel auf einen Pfad unterhalb des Basisverzeichnisses
	 * ab und weist alles ab, was hinausfuehrt. Schluessel entstehen zwar nur
	 * im eigenen Code ({@code FileService}), aber dieser Riegel kostet nichts
	 * und macht den Adapter unabhaengig von dieser Zusicherung.
	 */
	private Path resolve(String key) {
		Path target = baseDirectory.resolve(key).normalize();
		if (!target.startsWith(baseDirectory)) {
			throw new FileStorageException("Unzulaessiger Speicherschluessel: " + key);
		}
		return target;
	}
}
