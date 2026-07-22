package de.hsbremen.eportfolio.common.error;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Bildet Ausnahmen auf das einheitliche Fehler-Envelope ab (API-Contract §6.2).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(ValidierungException.class)
	public ResponseEntity<ApiFehler> behandleValidierung(ValidierungException ex, HttpServletRequest request) {
		ApiFehler fehler = new ApiFehler(
				Instant.now(),
				HttpStatus.BAD_REQUEST.value(),
				ex.getFehlercode(),
				ex.getMessage(),
				request.getRequestURI());
		return ResponseEntity.badRequest().body(fehler);
	}
}
