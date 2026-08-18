package de.hsbremen.eportfolio.file;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-Memory-Adapter fuer die Fachtests: Sichtbarkeit, Allowlist, Limits und
 * Statuscodes brauchen keinen echten Speicher (KAN-23). Nur die beiden
 * Adaptertests laufen gegen das Dateisystem beziehungsweise gegen Azurite.
 *
 * <p>Wird in {@code FileIntegrationTest} ueber {@code @TestBean} an die
 * Stelle des profilabhaengigen Adapters gesetzt; warum gerade nicht ueber
 * eine verschachtelte {@code @TestConfiguration} mit {@code @Primary},
 * begruendet der Javadoc-Kopf dort.
 */
public class InMemoryFileStorage implements FileStorage {

	private final Map<String, byte[]> objects = new ConcurrentHashMap<>();

	private final Map<String, String> contentTypes = new ConcurrentHashMap<>();

	@Override
	public void store(String key, InputStream data, long size, String contentType) {
		try {
			objects.put(key, data.readAllBytes());
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
		contentTypes.put(key, contentType);
	}

	@Override
	public InputStream load(String key) {
		byte[] bytes = objects.get(key);
		if (bytes == null) {
			throw new FileStorageException("Kein Objekt unter diesem Schluessel: " + key);
		}
		return new ByteArrayInputStream(bytes);
	}

	/** Ausschnitt aus dem Bytearray; die Grenzen hat die Aufrufseite geprueft. */
	@Override
	public InputStream load(String key, long offset, long length) {
		byte[] bytes = objects.get(key);
		if (bytes == null) {
			throw new FileStorageException("Kein Objekt unter diesem Schluessel: " + key);
		}
		return new ByteArrayInputStream(bytes, (int) offset, (int) length);
	}

	@Override
	public void delete(String key) {
		objects.remove(key);
		contentTypes.remove(key);
	}

	// ------------------------------------------------------------------
	// Einblick fuer die Tests
	// ------------------------------------------------------------------

	public void clear() {
		objects.clear();
		contentTypes.clear();
	}

	public int objectCount() {
		return objects.size();
	}

	public Set<String> keys() {
		return Set.copyOf(objects.keySet());
	}

	public String contentTypeOf(String key) {
		return contentTypes.get(key);
	}
}
