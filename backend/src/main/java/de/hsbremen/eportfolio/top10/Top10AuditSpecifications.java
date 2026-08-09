package de.hsbremen.eportfolio.top10;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/**
 * Bausteine der Where-Bedingung von {@code GET /api/admin/top10-audit} (§6.1):
 * {@code from}, {@code to} und {@code admin}.
 *
 * <p>Aufgebaut wie {@code AdminUserSpecifications}. Eine Sichtbarkeitsschranke
 * als Startwert gibt es auch hier nicht: das Protokoll liest nach §5 allein
 * ADMIN, und diese Rolle sieht jede Zeile.
 */
public final class Top10AuditSpecifications {

	private Top10AuditSpecifications() {
		// Nur statische Bausteine.
	}

	/**
	 * Filter {@code from}: Eintraege ab diesem Zeitpunkt, Grenze
	 * <strong>eingeschlossen</strong> (§6.1, praezisiert mit Contract v28).
	 */
	public static Specification<Top10AuditEntry> from(Instant from) {
		return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("timestamp"), from);
	}

	/**
	 * Filter {@code to}: Eintraege bis zu diesem Zeitpunkt, Grenze
	 * <strong>eingeschlossen</strong>.
	 *
	 * <p><strong>Warum inklusiv und nicht exklusiv.</strong> Die Oberflaeche
	 * bildet aus einem gewaehlten Tag dessen Ende in der Zeitzone der lesenden
	 * Person (KAN-40). Waere die obere Grenze exklusiv, fehlte dem Protokoll
	 * ausgerechnet der Eintrag, der genau auf dieser Grenze liegt, und ein
	 * Zeitraum „bis heute" liesse den heutigen Tag aus. Der Endpoint braucht
	 * dafuer keine serverseitig festgelegte Zeitzone.
	 */
	public static Specification<Top10AuditEntry> to(Instant to) {
		return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("timestamp"), to);
	}

	/**
	 * Filter {@code admin}: Eintraege einer handelnden Person, adressiert ueber
	 * ihre Konto-UUID wie {@code ?author=} und {@code ?editor=} bei
	 * {@code GET /api/projects}.
	 *
	 * <p>Verglichen wird ueber {@code admin.id} und nicht ueber einen Join auf
	 * {@code app_user}: der Fremdschluesselwert steht in der Protokollzeile
	 * selbst, ein Join koennte nichts hinzufuegen. Eine unbekannte UUID ist
	 * kein Fehler, sie filtert alles heraus; dieselbe Ueberlegung wie bei den
	 * Filter-IDs von {@code GET /api/projects}.
	 */
	public static Specification<Top10AuditEntry> admin(UUID adminId) {
		return (root, query, cb) -> cb.equal(root.get("admin").get("id"), adminId);
	}
}
