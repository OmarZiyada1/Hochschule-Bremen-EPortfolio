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
	private Instant erstelltAm;

	@LastModifiedDate
	@Column(nullable = false)
	private Instant aktualisiertAm;

	public Instant getErstelltAm() {
		return erstelltAm;
	}

	public Instant getAktualisiertAm() {
		return aktualisiertAm;
	}
}
