package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.user.dto.UserLookupResponse;
import java.util.List;
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
	 * @param role gewuenschte Rolle oder {@code null} fuer alle Rollen
	 * @param q    Suchbegriff ueber Vor- und Nachname oder {@code null}
	 */
	@Transactional(readOnly = true)
	public List<UserLookupResponse> lookup(Role role, String q) {
		Specification<User> specification = UserLookupSpecifications.active();
		if (role != null) {
			specification = specification.and(UserLookupSpecifications.role(role));
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
