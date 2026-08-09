package de.hsbremen.eportfolio.admin;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.User;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/**
 * Bausteine der Where-Bedingung von {@code GET /api/admin/users} (§6.1):
 * {@code role}, {@code status} und {@code q}.
 *
 * <p>Aufgebaut wie {@code ProjectSpecifications}, nur kleiner. Was dort die
 * Sichtbarkeitsschranke ist, gibt es hier bewusst nicht: die Nutzerverwaltung
 * sieht ausschliesslich ADMIN, und diese Rolle sieht nach §5 jedes Konto. Ein
 * Startwert, der immer wahr waere, taeuschte eine Schranke vor, die es nicht
 * gibt.
 */
public final class AdminUserSpecifications {

	private AdminUserSpecifications() {
		// Nur statische Bausteine.
	}

	/** Filter {@code role}: Konten einer Rolle (§2.1). */
	public static Specification<User> role(Role role) {
		return (root, query, cb) -> cb.equal(root.get("role"), role);
	}

	/** Filter {@code status}: Konten in einem Kontostatus (§2.9). */
	public static Specification<User> status(UserStatus status) {
		return (root, query, cb) -> cb.equal(root.get("status"), status);
	}

	/**
	 * Filter {@code q}: Suchbegriff ueber Vorname, Nachname und
	 * <strong>beide</strong> Adressen, unabhaengig von Gross- und
	 * Kleinschreibung.
	 *
	 * <p><strong>Auch ueber {@code hsbEmail}</strong>, anders als jede andere
	 * Suche im System. Das ist keine Ausweitung der Sichtbarkeit aus §3.1: dieser
	 * Endpoint gibt die Adresse ohnehin aus, und die Hochschulzugehoerigkeit ist
	 * genau das Merkmal, nach dem ein Admin ein Konto sucht, wenn er eine
	 * Weiterleitung aus dem Sekretariat vor sich hat. Ohne sie muesste er die
	 * Liste durchblaettern, um die Person zu finden, deren Adresse er kennt.
	 *
	 * <p>Die Wildcards des eingeschickten Begriffs werden maskiert, wie in
	 * {@code ProjectSpecifications}: ohne das machte ein einzelnes {@code %} aus
	 * dem Filter eine Volltabellenausgabe, und ein {@code _} traefe an jeder
	 * Stelle ein beliebiges Zeichen.
	 */
	public static Specification<User> searchText(String q) {
		return (root, query, cb) -> {
			String pattern = "%" + escapeWildcards(q.toLowerCase(Locale.ROOT)) + "%";
			return cb.or(
					cb.like(cb.lower(root.get("firstName")), pattern, ESCAPE_CHARACTER),
					cb.like(cb.lower(root.get("lastName")), pattern, ESCAPE_CHARACTER),
					cb.like(cb.lower(root.get("email")), pattern, ESCAPE_CHARACTER),
					cb.like(cb.lower(root.get("hsbEmail")), pattern, ESCAPE_CHARACTER));
		};
	}

	// ------------------------------------------------------------------

	/** Maskierzeichen fuer {@code like}, siehe {@link #searchText(String)}. */
	private static final char ESCAPE_CHARACTER = '\\';

	private static String escapeWildcards(String input) {
		return input
				.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
	}
}
