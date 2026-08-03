package de.hsbremen.eportfolio.common.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Basisklasse fuer Entities, deren Erstell- und Aenderungszeitpunkt automatisch gepflegt wird.
 */
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AuditableEntity extends BaseEntity {

	@CreatedDate
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	@Column(nullable = false)
	private Instant updatedAt;

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	/**
	 * Meldet eine Aenderung an, die sich in keinem Feld dieser Zeile
	 * niederschlaegt.
	 *
	 * <p><strong>Wozu das noetig ist:</strong> beim Autosave des Editors
	 * ({@code PUT /api/projects/{id}/blocks}, §6.1) aendern sich ausschliesslich
	 * Zeilen der Tabelle {@code block}. Die Zeile in {@code project} bleibt
	 * unberuehrt, Hibernate sieht dort also nichts Schmutziges, schreibt kein
	 * {@code UPDATE} und erhoeht damit weder {@code version} noch
	 * {@code updatedAt}. Beides waere falsch: ohne neue {@code version} liefe der
	 * naechste Autosave-Takt gegen einen Stand, der sich nie bewegt und den
	 * Schutz aus §6.4 wirkungslos macht; ohne neues {@code updatedAt} rutschte
	 * ein Projekt, an dem eine Stunde geschrieben wurde, in der nach
	 * {@code updatedAt} sortierten Projektliste hinter eines, an dem nur der
	 * Titel korrigiert wurde.
	 *
	 * <p>Der hier gesetzte Zeitstempel ist ein Zwischenwert und kein Ergebnis:
	 * er macht die Entity schmutzig, den endgueltigen Wert schreibt danach das
	 * JPA-Auditing im {@code @PreUpdate}. Deshalb gibt es weiterhin keinen
	 * Setter fuer {@code updatedAt}, mit dem sich von aussen ein beliebiger
	 * Zeitpunkt eintragen liesse.
	 */
	public void touch() {
		this.updatedAt = Instant.now();
	}
}
