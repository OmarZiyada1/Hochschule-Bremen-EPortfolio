package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.user.dto.UserLookupResponse;
import java.util.List;
import java.util.Objects;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fachlogik der Auswahlliste {@code GET /api/users/lookup} (§6.1, KAN-44).
 *
 * <p><strong>Ohne Paginierung</strong>, wie §6.1 es festlegt: die Liste fuellt
 * ein Auswahlfeld, und ein Auswahlfeld mit Seitennavigation waere keins. Wer
 * die Liste eingrenzen will, filtert ueber {@code q}.
 *
 * <p>Beide Filter sind optional, wie bei {@code GET /admin/users}: §6.1 nennt
 * sie in beiden Zeilen gleichlautend „Filter", und eine Auswahlhilfe fuer
 * Personenfelder (§6.1) ist nicht auf eine Rolle festgelegt. Die
 * Redaktionszuweisung fragt mit {@code role=EDITOR} an; kuenftige
 * Personenfelder wie die Projektmitglieder (§3.13) brauchen andere Werte.
 *
 * <p><strong>{@code role} nimmt seit Contract v89 mehrere Werte</strong>
 * (KAN-87), nach dem Muster der Sachfilter von {@code GET /projects} seit v43:
 * der Parameter darf wiederholt werden, seine Werte sind ODER-verknuepft und
 * stehen gegenueber {@code q} weiterhin in einem UND. Gebraucht wird das von
 * der Redaktionszuweisung, die seither {@code role=EDITOR&role=ADMIN} abfragt,
 * weil ein Admin-Konto zugewiesen werden kann (§5, Fussnoten 3 und 5). Mit
 * einem einwertigen Parameter braeuchte das Auswahlfeld zwei Abfragen je
 * Tastenanschlag und muesste die Sortierung nach Nachname selbst nachbauen,
 * die §6.1 dem Server zusagt.
 */
@Service
public class UserLookupService {

	private final UserRepository userRepository;

	public UserLookupService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	/**
	 * Sucht aktive Konten fuer ein Personen-Auswahlfeld.
	 *
	 * <p>Sortiert nach Nachname (§6.1), bei Gleichstand nach Vorname und
	 * zuletzt nach ID, damit die Reihenfolge deterministisch bleibt. Beides
	 * unabhaengig von Gross- und Kleinschreibung, sonst sortierte die
	 * Datenbank Grossbuchstaben geschlossen vor alle Kleinbuchstaben.
	 *
	 * <p><strong>Eine leere Rollenliste heisst „alle Rollen"</strong>, genau wie
	 * eine fehlende. Null-Elemente fallen vorher heraus: ein leerer Einzelwert
	 * wie in {@code ?role=EDITOR&role=} wird von Springs Konvertierung zu
	 * {@code null} im Listenelement, und ein {@code in} mit {@code null} darin
	 * vergliche gegen nichts. Dieselbe Umdeutung „leer heisst fehlend" wie bei
	 * {@code q} und bei den Sachfiltern der Projektliste
	 * ({@code ProjectReadService.addAll}).
	 *
	 * @param roles gewuenschte Rollen oder {@code null} beziehungsweise leer
	 *              fuer alle Rollen (§6.1, mehrwertig seit Contract v89)
	 * @param q     Suchbegriff ueber Vor- und Nachname oder {@code null}
	 */
	@Transactional(readOnly = true)
	public List<UserLookupResponse> lookup(List<Role> roles, String q) {
		Specification<User> specification = UserLookupSpecifications.active();
		List<Role> presentRoles = roles == null
				? List.of()
				: roles.stream().filter(Objects::nonNull).toList();
		if (!presentRoles.isEmpty()) {
			specification = specification.and(UserLookupSpecifications.role(presentRoles));
		}
		if (q != null && !q.isBlank()) {
			specification = specification.and(UserLookupSpecifications.nameContains(q.trim()));
		}

		Sort sort = Sort.by(
				Sort.Order.asc("lastName").ignoreCase(),
				Sort.Order.asc("firstName").ignoreCase(),
				Sort.Order.asc("id"));

		return userRepository.findAll(specification, sort).stream()
				.map(UserLookupResponse::from)
				.toList();
	}
}
