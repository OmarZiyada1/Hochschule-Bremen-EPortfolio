package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.benutzer.UserRepository;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ApiFehlerSchreiber;
import de.hsbremen.eportfolio.common.error.Fehlercodes;
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
 * <p>Fehlt der Header, laeuft die Anfrage ohne Authentication weiter — das ist
 * der PUBLIC-Fall aus §2.1 („kein Token vorhanden"). Ob das reicht, entscheidet
 * die SecurityFilterChain bzw. der Berechtigungsservice, nicht dieser Filter.
 *
 * <p>Ist ein Token da, aber unbrauchbar (falsche Signatur, abgelaufen,
 * unbekannte ID), bricht der Filter mit 401 im Envelope aus §6.2 ab, statt die
 * Anfrage still als anonym weiterlaufen zu lassen. Ein Client soll den
 * Unterschied zwischen „nicht angemeldet" und „dein Token taugt nicht mehr"
 * sehen — sonst quittiert das Frontend ein abgelaufenes Token mit einer leeren
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
public class JwtAuthentifizierungsFilter extends OncePerRequestFilter {

	private static final String BEARER_PRAEFIX = "Bearer ";

	private final JwtService jwtService;

	private final UserRepository userRepository;

	private final ApiFehlerSchreiber fehlerSchreiber;

	public JwtAuthentifizierungsFilter(JwtService jwtService, UserRepository userRepository,
			ApiFehlerSchreiber fehlerSchreiber) {
		this.jwtService = jwtService;
		this.userRepository = userRepository;
		this.fehlerSchreiber = fehlerSchreiber;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {

		String token = leseToken(request);
		if (token == null) {
			filterChain.doFilter(request, response);
			return;
		}

		AngemeldeterBenutzer benutzer;
		try {
			UUID benutzerId = jwtService.leseBenutzerId(token);
			benutzer = ladeAktivenBenutzer(benutzerId);
		} catch (JwtService.TokenAbgelaufenException ex) {
			fehlerSchreiber.schreibe(request, response, HttpStatus.UNAUTHORIZED.value(),
					Fehlercodes.TOKEN_ABGELAUFEN, ex.getMessage());
			return;
		} catch (JwtService.TokenUngueltigException ex) {
			fehlerSchreiber.schreibe(request, response, HttpStatus.UNAUTHORIZED.value(),
					Fehlercodes.TOKEN_UNGUELTIG, ex.getMessage());
			return;
		} catch (KontoNichtAktivException ex) {
			fehlerSchreiber.schreibe(request, response, HttpStatus.UNAUTHORIZED.value(),
					Fehlercodes.KONTO_NICHT_AKTIV, ex.getMessage());
			return;
		}

		UsernamePasswordAuthenticationToken authentifizierung =
				new UsernamePasswordAuthenticationToken(benutzer, null, benutzer.getAuthorities());
		authentifizierung.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
		SecurityContextHolder.getContext().setAuthentication(authentifizierung);

		filterChain.doFilter(request, response);
	}

	private AngemeldeterBenutzer ladeAktivenBenutzer(UUID benutzerId) {
		AngemeldeterBenutzer benutzer = userRepository.findById(benutzerId)
				.map(AngemeldeterBenutzer::aus)
				.orElseThrow(() -> new JwtService.TokenUngueltigException(
						"Zu diesem Token existiert kein Konto."));

		if (benutzer.getStatus() != UserStatus.AKTIV) {
			throw new KontoNichtAktivException(
					"Das Konto ist nicht aktiv und kann die API nicht nutzen.");
		}
		return benutzer;
	}

	private String leseToken(HttpServletRequest request) {
		String header = request.getHeader(HttpHeaders.AUTHORIZATION);
		if (header == null || !header.startsWith(BEARER_PRAEFIX)) {
			return null;
		}
		String token = header.substring(BEARER_PRAEFIX.length()).trim();
		return token.isEmpty() ? null : token;
	}

	/** Konto zwischenzeitlich deaktiviert (§2.9), obwohl das Token noch laeuft. */
	static class KontoNichtAktivException extends RuntimeException {
		KontoNichtAktivException(String meldung) {
			super(meldung);
		}
	}
}
