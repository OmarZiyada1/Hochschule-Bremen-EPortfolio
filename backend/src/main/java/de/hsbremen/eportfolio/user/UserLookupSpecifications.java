package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/**
 * Bausteine der Where-Bedingung von {@code GET /api/users/lookup} (§6.1):
 * die ACTIVE-Schranke sowie die Filter {@code role} und {@code q}.
 *
 * <p>Aufgebaut wie {@code admin.AdminUserSpecifications}, aber bewusst nicht
 * mit ihr geteilt: die beiden Endpoints unterscheiden sich genau dort, wo es
 * fachlich darauf ankommt. Die Admin-Suche laeuft ueber beide Adressen, weil
 * ihre Antwort die Adressen ohnehin ausgibt; diese hier darf das nicht, siehe
 * {@link #nameContains(String)}.
 */
public final class UserLookupSpecifications {

	private UserLookupSpecifications() {
		// Nur statische Bausteine.
	}

	/**
	 * Die Sichtbarkeitsschranke der Auswahlliste: nur Konten mit
	 * {@code status = ACTIVE} (§6.1). Sie ist Startwert der UND-Verknuepfung
	 * im Service, damit kein Filter sie aufweichen kann; ein deaktiviertes
	 * oder unfertiges Konto soll niemandem zur Auswahl angeboten werden.
	 */
	public static Specification<User> active() {
		return (root, query, cb) -> cb.equal(root.get("status"), UserStatus.ACTIVE);
	}

	/** Filter {@code role}: Konten einer Rolle (§2.1). */
	public static Specification<User> role(Role role) {
		return (root, query, cb) -> cb.equal(root.get("role"), role);
	}

	/**
	 * Filter {@code q}: Suchbegriff ueber Vorname und Nachname, unabhaengig
	 * von Gross- und Kleinschreibung.
	 *
	 * <p><strong>Bewusst nicht ueber die E-Mail-Adressen</strong>, anders als
	 * die Admin-Suche. Die Antwort dieses Endpoints enthaelt keine Adressen;
	 * traefe der Filter trotzdem auf sie zu, liesse sich mit {@code q=adresse}
	 * am Treffer ablesen, ob ein Konto zu dieser Adresse existiert. Der
	 * Endpoint waere damit fuer jede angemeldete Person ein Verzeichnis
	 * registrierter Adressen, genau das, was §6.1 an mehreren Stellen
	 * ausschliesst; fuer {@code hsbEmail} verbietet §3.1 jede Sichtbarkeit
	 * ausserhalb der Administrationsseite ohnehin.
	 *
	 * <p>Die Wildcards des eingeschickten Begriffs werden maskiert, wie in
	 * {@code AdminUserSpecifications}: ohne das machte ein einzelnes {@code %}
	 * aus dem Filter eine Volltabellenausgabe.
	 */
	public static Specification<User> nameContains(String q) {
		return (root, query, cb) -> {
			String pattern = "%" + escapeWildcards(q.toLowerCase(Locale.ROOT)) + "%";
			return cb.or(
					cb.like(cb.lower(root.get("firstName")), pattern, ESCAPE_CHARACTER),
					cb.like(cb.lower(root.get("lastName")), pattern, ESCAPE_CHARACTER));
		};
	}

	// ------------------------------------------------------------------

	/** Maskierzeichen fuer {@code like}, siehe {@link #nameContains(String)}. */
	private static final char ESCAPE_CHARACTER = '\\';

	private static String escapeWildcards(String input) {
		return input
				.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
	}
}
