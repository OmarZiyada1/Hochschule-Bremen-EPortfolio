package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.common.enums.VerificationPurpose;
import de.hsbremen.eportfolio.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Einmalcode aus dem Registrierungsflow (API-Contract §3.16).
 *
 * <p>Erbt wie {@code Reaction} bewusst nicht von {@code AuditableEntity}: ein
 * Code entsteht und wird hoechstens entwertet, aber nie inhaltlich geaendert.
 * §3.16 fuehrt deshalb nur {@code createdAt}.
 *
 * <p><strong>Der Klartext steht nirgends in dieser Klasse.</strong> Gespeichert
 * ist ausschliesslich {@code codeHash}; den Klartext kennt nur die Person im
 * Postfach und, fuer die Dauer eines Aufrufs, der
 * {@link VerificationCodeService}. Aus demselben Grund gibt es hier kein
 * {@code toString}, das den Hash preisgibt.
 *
 * <p><strong>Die Sicherheit stammt nicht aus der Laenge des Codes</strong>,
 * sechs Stellen sind eine Million Moeglichkeiten. Sie stammt aus drei Dingen
 * zusammen: {@link #expiresAt}, der Einmalverwendung ueber {@link #consumed}
 * und dem Rate-Limit in {@link VerificationAttemptService}. Faellt eines davon
 * weg, traegt der Rest die Zusage aus §3.16 nicht mehr.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
public class VerificationCode extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private VerificationPurpose purpose;

	@Column(nullable = false, length = 255)
	private String codeHash;

	@Column(nullable = false)
	private Instant expiresAt;

	@Column(nullable = false)
	private boolean consumed;

	@CreatedDate
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected VerificationCode() {
		// Von JPA benoetigt.
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	public VerificationPurpose getPurpose() {
		return purpose;
	}

	public void setPurpose(VerificationPurpose purpose) {
		this.purpose = purpose;
	}

	public String getCodeHash() {
		return codeHash;
	}

	public void setCodeHash(String codeHash) {
		this.codeHash = codeHash;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public void setExpiresAt(Instant expiresAt) {
		this.expiresAt = expiresAt;
	}

	public boolean isConsumed() {
		return consumed;
	}

	public void setConsumed(boolean consumed) {
		this.consumed = consumed;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	/**
	 * Ob dieser Code jetzt noch eingeloest werden kann: weder verbraucht noch
	 * abgelaufen.
	 *
	 * <p>Die Uhr kommt als Parameter und nicht aus {@code Instant.now()}, damit
	 * der Ablauf im Test ohne Warten pruefbar ist, wie beim
	 * {@code LoginAttemptService}.
	 */
	public boolean isUsable(Instant now) {
		return !consumed && expiresAt.isAfter(now);
	}
}
