package de.hsbremen.eportfolio.file;

import java.io.InputStream;

/**
 * Port fuer den Objektspeicher (API-Contract §6.8, §3.15.1).
 *
 * <p>Die Anwendung kennt keinen Anbieter, sondern nur dieses Interface.
 * Welcher Adapter dahinter arbeitet, entscheidet {@code app.storage.provider}
 * ({@code local} oder {@code azure}); ein Anbieterwechsel ist damit eine
 * zusaetzliche Adapterklasse und kein Eingriff in das Fachmodul. Ein
 * Fallback-Adapter ist ausdruecklich nicht vorgesehen: faellt die Property
 * weg, scheitert der Kontext (§6.8).
 *
 * <p><strong>Der Schluessel ist anbieterneutral</strong> (§3.15.1): die Form
 * ist {@code projects/{projectId}/{uuid}} beziehungsweise
 * {@code avatars/{uuid}}, ohne Container, Endpoint oder Verzeichnis. Er steht
 * in {@code StoredFile.path} und verlaesst den Server nie.
 */
public interface FileStorage {

	/**
	 * Legt das Objekt unter dem Schluessel ab.
	 *
	 * @param key         anbieterneutraler Schluessel; die Aufrufseite vergibt
	 *                    ihn mit einer frischen UUID, Kollisionen gibt es
	 *                    deshalb nicht
	 * @param data        Inhalt; die Aufrufseite schliesst den Strom
	 * @param size        Laenge in Bytes, vorab bekannt, weil Azure sie beim
	 *                    Upload verlangt
	 * @param contentType MIME-Typ aus der Allowlist (§3.15), damit der
	 *                    Speicher ihn am Objekt fuehren kann
	 * @throws FileStorageException wenn die Ablage scheitert
	 */
	void store(String key, InputStream data, long size, String contentType);

	/**
	 * Liest das Objekt.
	 *
	 * @return Strom ueber den Inhalt; die Aufrufseite schliesst ihn
	 * @throws FileStorageException wenn es unter dem Schluessel kein Objekt
	 *         gibt oder das Lesen scheitert
	 */
	InputStream load(String key);

	/**
	 * Liest einen Ausschnitt des Objekts (§3.15, HTTP-Range).
	 *
	 * <p><strong>Warum die Methode am Port steht und nicht im Controller.</strong>
	 * Ein erst dort gebildeter Ausschnitt hiesse: das ganze Objekt aus dem
	 * Speicher ziehen und den ueberwiegenden Teil davon wegwerfen. Bei einem
	 * 200-MB-Video waeren das je Sprung in der Zeitleiste 200 MB ueber das
	 * Netz zum Objektspeicher, fuer wenige hundert Kilobyte Nutzlast. Azure
	 * beherrscht Bereichsabrufe serverseitig, das Dateisystem beherrscht sie
	 * ueber die Position im Kanal; beides ist nur erreichbar, wenn der Port
	 * die Werte durchreicht.
	 *
	 * <p>Die Aufrufseite hat {@code offset} und {@code length} bereits gegen
	 * {@code StoredFile.size} geprueft (§6.2,
	 * {@code FILE_RANGE_NOT_SATISFIABLE}); der Adapter darf sich darauf
	 * verlassen und braucht keine eigene Bereichsrechnung.
	 *
	 * @param key    anbieterneutraler Schluessel
	 * @param offset erstes zu lesendes Byte, nullbasiert
	 * @param length Anzahl der Bytes, groesser als 0
	 * @return Strom ueber genau diesen Ausschnitt; die Aufrufseite schliesst ihn
	 * @throws FileStorageException wenn es unter dem Schluessel kein Objekt
	 *         gibt oder das Lesen scheitert
	 */
	InputStream load(String key, long offset, long length);

	/**
	 * Entfernt das Objekt. Ein fehlendes Objekt ist kein Fehler: das Ziel
	 * "weg" ist dann bereits erreicht.
	 *
	 * @throws FileStorageException wenn das Loeschen scheitert
	 */
	void delete(String key);
}
