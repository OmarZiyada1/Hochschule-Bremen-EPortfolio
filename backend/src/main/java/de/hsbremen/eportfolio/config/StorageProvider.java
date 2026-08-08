package de.hsbremen.eportfolio.config;

/**
 * Auswaehlbare Adapter des Ports {@code FileStorage} (API-Contract §6.8).
 *
 * <p>Der Wert steht in {@code app.storage.provider} und entscheidet, welche
 * Implementierung KAN-23 ueber {@code @ConditionalOnProperty} aktiviert. Ein
 * Enum statt eines freien Strings, damit ein Tippfehler beim Start scheitert
 * und nicht erst beim ersten Upload: {@code azrue} bindet nicht und die
 * Anwendung kommt gar nicht erst hoch.
 *
 * <p><strong>Es gibt bewusst keinen Default.</strong> Faellt die Property weg,
 * scheitert der Kontext an {@code @NotNull} in {@link StorageProperties}. Ein
 * stiller Rueckfall auf {@link #LOCAL} wuerde ein Produktivsystem Dateien neben
 * die Anwendung schreiben lassen, wo sie der naechste Container-Neubau
 * mitnimmt (§3.15.1).
 */
public enum StorageProvider {

	/**
	 * Ablage im Dateisystem unter {@code app.storage.local-directory}. Fuer die
	 * Entwicklung, damit zum Arbeiten am Editor kein Fremddienst noetig ist.
	 */
	LOCAL,

	/**
	 * Azure Blob Storage. Der Betriebsfall seit Contract v21.
	 *
	 * <p>Bis v20 stand hier ein S3-kompatibler Speicher. Die Umstellung ist eine
	 * Entscheidung ueber die Betriebsumgebung und keine fachliche: was §3.15.1
	 * ueber Sichtbarkeit, den anbieterneutralen Schluessel und die Auslieferung
	 * ausschliesslich ueber {@code GET /api/files/{id}} sagt, gilt unveraendert.
	 */
	AZURE
}
