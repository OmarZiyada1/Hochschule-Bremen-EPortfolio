package de.hsbremen.eportfolio.common.error;

/**
 * Fachlicher Validierungsfehler. Wird vom {@link GlobalExceptionHandler} auf
 * HTTP 400 mit dem Envelope aus API-Contract §6.2 abgebildet.
 */
public class ValidierungException extends RuntimeException {

	private final String fehlercode;

	public ValidierungException(String fehlercode, String meldung) {
		super(meldung);
		this.fehlercode = fehlercode;
	}

	public String getFehlercode() {
		return fehlercode;
	}
}
