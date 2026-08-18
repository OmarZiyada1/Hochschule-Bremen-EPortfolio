package de.hsbremen.eportfolio.file;

import com.azure.core.util.Context;
import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobContainerClientBuilder;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.models.BlobRange;
import com.azure.storage.blob.models.BlobStorageException;
import com.azure.storage.blob.options.BlobInputStreamOptions;
import com.azure.storage.blob.options.BlobParallelUploadOptions;
import de.hsbremen.eportfolio.config.StorageProperties;
import java.io.InputStream;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adapter fuer {@code app.storage.provider=azure}: Azure Blob Storage
 * (API-Contract §6.8, §3.15.1), im Entwicklungstest der Emulator Azurite.
 *
 * <p><strong>Der Client entsteht hier selbst aus {@link StorageProperties}</strong>
 * und nicht ueber den Spring-Cloud-Azure-Starter: der braechte eine zweite,
 * eigene Property-Bindung mit, die neben der aus KAN-50 liefe und deren
 * Fail-Fast-Pruefung (fehlender Wert bricht den Start ab, §6.8) unterliefe.
 *
 * <p><strong>Der Container wird nicht angelegt.</strong> Fehlt er, scheitert
 * der erste Zugriff, und das ist gewollt: ein Produktivsystem, das sich
 * seinen Container selbst erzeugt, verdeckt eine falsch konfigurierte
 * Umgebung, und das Anlegen verlangt Rechte, die das Laufzeitkonto nicht
 * braucht.
 *
 * <p>Die Verbindungszeichenfolge ist ein Geheimnis (§6.8) und erscheint in
 * keiner Meldung dieses Adapters; die Ausnahmen nennen nur den Schluessel.
 */
@Component
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "azure")
public class AzureBlobFileStorage implements FileStorage {

	private final BlobContainerClient container;

	public AzureBlobFileStorage(StorageProperties properties) {
		this.container = new BlobContainerClientBuilder()
				.connectionString(properties.connectionString())
				.containerName(properties.container())
				.buildClient();
	}

	/**
	 * Der MIME-Typ wandert als {@code Content-Type} an das Blob. Er wird beim
	 * Ausliefern zwar aus der Datenbankzeile gesetzt, nicht aus dem Speicher;
	 * am Objekt gefuehrt macht er den Bestand aber auch ohne die Datenbank
	 * lesbar, etwa fuer die im Ausblick genannten signierten URLs (§3.15.1).
	 */
	@Override
	public void store(String key, InputStream data, long size, String contentType) {
		try {
			BlobParallelUploadOptions options = new BlobParallelUploadOptions(data, size)
					.setHeaders(new BlobHttpHeaders().setContentType(contentType));
			blob(key).uploadWithResponse(options, null, Context.NONE);
		} catch (BlobStorageException e) {
			throw new FileStorageException("Objekt konnte nicht abgelegt werden: " + key, e);
		}
	}

	@Override
	public InputStream load(String key) {
		try {
			return blob(key).openInputStream();
		} catch (BlobStorageException e) {
			throw new FileStorageException("Kein Objekt unter diesem Schluessel: " + key, e);
		}
	}

	/**
	 * Der Ausschnitt entsteht bei Azure serverseitig: {@link BlobRange} wird
	 * zum {@code Range}-Kopf der Speicheranfrage, es kommen also nur die
	 * angeforderten Bytes ueber das Netz. Genau dafuer steht die Methode am
	 * Port (§3.15.1).
	 */
	@Override
	public InputStream load(String key, long offset, long length) {
		try {
			BlobInputStreamOptions options = new BlobInputStreamOptions()
					.setRange(new BlobRange(offset, length));
			return blob(key).openInputStream(options);
		} catch (BlobStorageException e) {
			throw new FileStorageException("Kein Objekt unter diesem Schluessel: " + key, e);
		}
	}

	@Override
	public void delete(String key) {
		try {
			blob(key).deleteIfExists();
		} catch (BlobStorageException e) {
			throw new FileStorageException("Objekt konnte nicht geloescht werden: " + key, e);
		}
	}

	private BlobClient blob(String key) {
		return container.getBlobClient(key);
	}
}
