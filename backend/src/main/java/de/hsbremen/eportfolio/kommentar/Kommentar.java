package de.hsbremen.eportfolio.kommentar;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.common.enums.KommentarStatus;
import de.hsbremen.eportfolio.common.enums.KommentarTyp;
import de.hsbremen.eportfolio.projekt.Projekt;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Rueckmeldung zu einem Projekt. Der Status ist nur bei
 * {@link KommentarTyp#AENDERUNG} gesetzt, sonst null; geprueft wird das im
 * Service, nicht in der Datenbank.
 */
@Entity
public class Kommentar extends AuditableEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "projekt_id", nullable = false)
	private Projekt projekt;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "autor_id", nullable = false)
	private User autor;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private KommentarTyp typ;

	@Column(columnDefinition = "text", nullable = false)
	private String text;

	@Enumerated(EnumType.STRING)
	@Column(length = 32)
	private KommentarStatus status;

	protected Kommentar() {
		// Von JPA benoetigt.
	}

	public Projekt getProjekt() {
		return projekt;
	}

	public void setProjekt(Projekt projekt) {
		this.projekt = projekt;
	}

	public User getAutor() {
		return autor;
	}

	public void setAutor(User autor) {
		this.autor = autor;
	}

	public KommentarTyp getTyp() {
		return typ;
	}

	public void setTyp(KommentarTyp typ) {
		this.typ = typ;
	}

	public String getText() {
		return text;
	}

	public void setText(String text) {
		this.text = text;
	}

	public KommentarStatus getStatus() {
		return status;
	}

	public void setStatus(KommentarStatus status) {
		this.status = status;
	}
}
