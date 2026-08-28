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
import java.util.Set;
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
 * <p><strong>Nachladen aus der Datenbank:</strong> Rolle, Status und
 * {@code passwordChangeRequired} kommen bei jedem Request frisch aus
 * {@code app_user}, nicht aus den Token-Claims. Das kostet eine Abfrage pro
 * Anfrage, ist aber der Preis dafuer, dass ein vom Admin deaktiviertes Konto
 * (§2.9) sofort ausgesperrt ist und nicht erst nach Ablauf des Tokens. Bei
 * acht Stunden Laufzeit waere das sonst ein reales Zeitfenster.
 *
 * <p><strong>Gate der erzwungenen Passwortaenderung (§6.7):</strong> traegt
 * das Konto ein administrativ gesetztes Initialpasswort
 * ({@code passwordChangeRequired}), antwortet der Filter auf alle Endpoints
 * mit 403 {@code PASSWORD_CHANGE_REQUIRED}, auch auf oeffentliche, sofern die
 * Anfrage ein Token traegt. Das Gate sitzt hier und nicht im Frontend, weil
 * eine reine Client-Umleitung ueber direkte API-Aufrufe vollstaendig umgehbar
 * waere. Ausgenommen sind genau die sechs Endpoints aus §6.7, sonst sperrte
 * sich die Person selbst aus; die Pfade der Passwort-Ruecksetzung standen hier
 * schon vor KAN-43 bereit. {@code POST /api/support} kam mit KAN-85 dazu
 * (Contract v87): der Endpoint ist ohnehin PUBLIC, das Gate greift bei ihm
 * allein deshalb, weil es jede Anfrage <em>mit</em> Token trifft. Ohne die
 * Ausnahme bekaeme ausgerechnet die im Initialpasswort feststeckende Person
 * auf ihre Hilfeanfrage ein 403, waehrend dieselbe Anfrage nach dem Abmelden
 * durchginge, und das waere eine Huerde ohne Schutzwirkung: die Absendung
 * schreibt eine Zeile in ein Eingangsbuch und stellt nichts an.
 * {@code POST /admin/users/{id}/reset-password}
 * (KAN-43) steht bewusst nicht in der Liste: ihn ruft ein Admin mit eigenem
 * Token fuer ein fremdes Konto auf, nicht das gesperrte Konto selbst; ein
 * Admin mit eigenem Initialpasswort aendert erst sein Passwort und verwaltet
 * dann.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String BEARER_PREFIX = "Bearer ";

	/**
	 * Die sechs Ausnahmen vom Gate der erzwungenen Passwortaenderung (§6.7),
	 * als "METHODE Pfad". Die ersten fuenf existieren, damit die Person das
	 * Flag selbst aufloesen kann: Passwort aendern, die eigene Identitaet fuer
	 * die Passwortseite lesen, sich abmelden oder das vergessene
	 * Initialpasswort zuruecksetzen (KAN-43). Die sechste ist das
	 * Kontaktformular (KAN-85): wer im Initialpasswort feststeckt, ist genau
	 * der Fall, fuer den es das Formular gibt.
	 */
	private static final Set<String> PASSWORD_CHANGE_EXEMPT = Set.of(
			"PUT /api/auth/password",
			"GET /api/auth/me",
			"POST /api/auth/logout",
			"POST /api/auth/forgot-password",
			"POST /api/auth/reset-password",
			"POST /api/support");

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

		if (user.isPasswordChangeRequired() && !isPasswordChangeExempt(request)) {
			errorWriter.write(request, response, HttpStatus.FORBIDDEN.value(),
					ErrorCodes.PASSWORD_CHANGE_REQUIRED,
					"Das Initialpasswort muss zuerst geaendert werden (PUT /api/auth/password).");
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

	/**
	 * Exakter Vergleich auf Methode + Pfad, kein Praefix- oder Mustervergleich:
	 * ein Muster wie {@code /api/auth/**} naehme kuenftige Auth-Endpoints
	 * stillschweigend vom Gate aus, obwohl §6.7 genau fuenf Ausnahmen nennt.
	 */
	private boolean isPasswordChangeExempt(HttpServletRequest request) {
		return PASSWORD_CHANGE_EXEMPT.contains(request.getMethod() + " " + request.getRequestURI());
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
