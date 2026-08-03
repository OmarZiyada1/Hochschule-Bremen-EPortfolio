package de.hsbremen.eportfolio.common.error;

/**
 * Fachlicher Validierungsfehler. Wird vom {@link GlobalExceptionHandler} auf
 * HTTP 400 mit dem Envelope aus API-Contract §6.2 abgebildet.
 */
public class ValidationException extends RuntimeException {

	private final String errorCode;

	public ValidationException(String errorCode, String message) {
		super(message);
		this.errorCode = errorCode;
	}

	public String getErrorCode() {
		return errorCode;
	}
}
