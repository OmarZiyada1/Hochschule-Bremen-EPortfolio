package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf die Einmalcodes (API-Contract §3.16).
 */
public interface VerificationCodeRepository extends JpaRepository<VerificationCode, UUID> {

	/**
	 * Alle noch nicht verbrauchten Codes eines Kontos zu einem Zweck, neuester
	 * zuerst.
	 *
	 * <p>Im Regelfall ist das genau einer, weil das erneute Senden den
	 * vorherigen entwertet (§6.1). Die Abfrage liefert trotzdem eine Liste: die
	 * Pruefung "gibt es schon einen?" und das Anlegen sind nicht atomar, zwei
	 * gleichzeitige Anfragen koennen also zwei offene Codes hinterlassen. Beide
	 * dann zu pruefen ist richtiger, als den aelteren stillschweigend
	 * abzulehnen, obwohl er in einem Postfach liegt.
	 */
	List<VerificationCode> findByUserIdAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
			UUID userId, VerificationPurpose purpose);

	/**
	 * Raeumt verbrauchte und abgelaufene Codes weg (§3.16, „Aufraeumen").
	 *
	 * <p>Bewusst eine abgeleitete {@code deleteBy}-Methode und kein
	 * {@code @Modifying}-Query: sie laedt die Zeilen und loescht sie einzeln, was
	 * bei diesen Mengen nicht ins Gewicht faellt und dafuer ohne
	 * Cache-Umgehung auskommt.
	 *
	 * @param threshold Zeitpunkt, vor dem ein Code als abgelaufen gilt
	 * @return Anzahl der entfernten Zeilen, nur fuers Protokoll
	 */
	long deleteByConsumedTrueOrExpiresAtBefore(Instant threshold);
}
