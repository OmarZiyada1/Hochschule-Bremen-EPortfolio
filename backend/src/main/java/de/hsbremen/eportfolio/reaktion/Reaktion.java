package de.hsbremen.eportfolio.reaktion;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.projekt.Projekt;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Reaktion einer Person auf ein Projekt. Erbt bewusst nicht von
 * AuditableEntity, weil eine Reaktion nur entsteht und nie geaendert wird -
 * es gibt daher nur erstelltAm und kein aktualisiertAm.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
public class Reaktion extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "projekt_id", nullable = false)
	private Projekt projekt;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@CreatedDate
	@Column(nullable = false, updatable = false)
	private Instant erstelltAm;

	protected Reaktion() {
		// Von JPA benoetigt.
	}

	public Projekt getProjekt() {
		return projekt;
	}

	public void setProjekt(Projekt projekt) {
		this.projekt = projekt;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	public Instant getErstelltAm() {
		return erstelltAm;
	}
}
