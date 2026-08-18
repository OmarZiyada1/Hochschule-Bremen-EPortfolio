package de.hsbremen.eportfolio.common.error;

/**
 * Der angeforderte Bereich einer Datei liegt jenseits ihrer Groesse
 * (API-Contract §6.2, {@code FILE_RANGE_NOT_SATISFIABLE}, HTTP 416).
 *
 * <p><strong>Warum ein eigener Fehlercode und keine stille Vollauslieferung.</strong>
 * RFC 9110 unterscheidet zwei Faelle. Einen Range-Kopf, den der Server nicht
 * versteht, <em>ignoriert</em> er und antwortet mit 200 und dem vollstaendigen
 * Inhalt; das tut {@code FileService} auch. Ein verstandener, aber
 * unerfuellbarer Bereich ist dagegen ein Client-Fehler und wird mit 416
 * beantwortet. Ohne diese Unterscheidung bekaeme ein Medienelement, das an
 * einer falsch berechneten Stelle weiterlesen will, stillschweigend die ganze
 * Datei von vorn.
 *
 * <p><strong>Warum die Ausnahme die Dateigroesse traegt.</strong> Die Antwort
 * auf einen 416 muss nach RFC 9110 {@code Content-Range: bytes &#42;/&lt;size&gt;}
 * setzen, damit der Client seine Rechnung korrigieren kann, ohne die Datei
 * erneut anzufragen. Der {@code GlobalExceptionHandler} baut den Kopf daraus;
 * ohne den Wert an der Ausnahme muesste er die Zeile ein zweites Mal laden.
 *
 * <p>Vergeben mit KAN-72, in §6.2 nachgetragen mit Contract v52.
 */
public class RangeNotSatisfiableException extends RuntimeException {

	private final long totalSize;

	public RangeNotSatisfiableException(long totalSize) {
		super("Der angeforderte Bereich liegt jenseits der Dateigroesse von " + totalSize
				+ " Bytes (§3.15).");
		this.totalSize = totalSize;
	}

	/** Groesse der Datei in Bytes, fuer {@code Content-Range: bytes &#42;/&lt;size&gt;}. */
	public long getTotalSize() {
		return totalSize;
	}
}
