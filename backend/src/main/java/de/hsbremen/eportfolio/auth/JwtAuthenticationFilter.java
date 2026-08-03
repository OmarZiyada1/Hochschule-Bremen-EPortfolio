package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ApiErrorWriter;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Prueft das Bearer-Token jeder Anfrage und setzt den SecurityContext.
 *
 * <p>Fehlt der Header, laeuft die Anfrage ohne Authentication weiter. Das ist
 * der PUBLIC-Fall aus §2.1 („kein Token vorhanden"). Ob das reicht, entscheidet
 * die SecurityFilterChain bzw. der Berechtigungsservice, nicht dieser Filter.
 *
 * <p>Ist ein Token da, aber unbrauchbar (falsche Signatur, abgelaufen,
 * unbekannte ID), bricht der Filter mit 401 im Envelope aus §6.2 ab, statt die
 * Anfrage still als anonym weiterlaufen zu lassen. Ein Client soll den
 * Unterschied zwischen „nicht angemeldet" und „dein Token taugt nicht mehr"
 * sehen; sonst quittiert das Frontend ein abgelaufenes Token mit einer leeren
 * Liste statt mit einer Anmeldeaufforderung.
 *
 * <p><strong>Nachladen aus der Datenbank:</strong> Rolle und Status kommen bei
 * jedem Request frisch aus {@code app_user}, nicht aus den Token-Claims. Das
 * kostet eine Abfrage pro Anfrage, ist aber der Preis dafuer, dass ein vom
 * Admin deaktiviertes Konto (§2.9) sofort ausgesperrt ist und nicht erst nach
 * Ablauf des Tokens. Bei acht Stunden Laufzeit waere das sonst ein reales
 * Zeitfenster.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String BEARER_PREFIX = "Bearer ";

	private final JwtService jwtService;

	private final UserRepository userRepository;

	private final ApiErrorWriter errorWriter;

	public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository,
			ApiErrorWriter errorWriter) {
		this.jwtService = jwtService;
		this.userRepository = userRepository;
		this.errorWriter = errorWriter;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {

		String token = readToken(request);
		if (token == null) {
			filterChain.doFilter(request, response);
			return;
		}

		AuthenticatedUser user;
		try {
			UUID userId = jwtService.readUserId(token);
			user = loadActiveUser(userId);
		} catch (JwtService.TokenExpiredException ex) {
			errorWriter.write(request, response, HttpStatus.UNAUTHORIZED.value(),
					ErrorCodes.TOKEN_EXPIRED, ex.getMessage());
			return;
		} catch (JwtService.TokenInvalidException ex) {
			errorWriter.write(request, response, HttpStatus.UNAUTHORIZED.value(),
					ErrorCodes.TOKEN_INVALID, ex.getMessage());
			return;
		} catch (AccountNotActiveException ex) {
			errorWriter.write(request, response, HttpStatus.UNAUTHORIZED.value(),
					ErrorCodes.ACCOUNT_NOT_ACTIVE, ex.getMessage());
			return;
		}

		UsernamePasswordAuthenticationToken authentication =
				new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
		authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
		SecurityContextHolder.getContext().setAuthentication(authentication);

		filterChain.doFilter(request, response);
	}

	private AuthenticatedUser loadActiveUser(UUID userId) {
		AuthenticatedUser user = userRepository.findById(userId)
				.map(AuthenticatedUser::from)
				.orElseThrow(() -> new JwtService.TokenInvalidException(
						"Zu diesem Token existiert kein Konto."));

		if (user.getStatus() != UserStatus.ACTIVE) {
			throw new AccountNotActiveException(
					"Das Konto ist nicht aktiv und kann die API nicht nutzen.");
		}
		return user;
	}

	private String readToken(HttpServletRequest request) {
		String header = request.getHeader(HttpHeaders.AUTHORIZATION);
		if (header == null || !header.startsWith(BEARER_PREFIX)) {
			return null;
		}
		String token = header.substring(BEARER_PREFIX.length()).trim();
		return token.isEmpty() ? null : token;
	}

	/** Konto zwischenzeitlich deaktiviert (§2.9), obwohl das Token noch laeuft. */
	static class AccountNotActiveException extends RuntimeException {
		AccountNotActiveException(String message) {
			super(message);
		}
	}
}
