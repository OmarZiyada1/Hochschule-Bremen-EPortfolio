package de.hsbremen.eportfolio.projekt;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Ein Statusuebergang eines Projekts. vonStatus ist beim ersten Uebergang
 * null, weil es dann noch keinen Vorzustand gibt.
 */
@Entity
@Table(name = "projekt_status_historie")
public class ProjektStatusHistorie extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "projekt_id", nullable = false)
	private Projekt projekt;

	@Enumerated(EnumType.STRING)
	@Column(length = 32)
	private ProjektStatus vonStatus;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ProjektStatus nachStatus;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "geaendert_von", nullable = false)
	private User geaendertVon;

	@Column(nullable = false)
	private Instant zeitpunkt;

	protected ProjektStatusHistorie() {
		// Von JPA benoetigt.
	}

	public Projekt getProjekt() {
		return projekt;
	}

	public void setProjekt(Projekt projekt) {
		this.projekt = projekt;
	}

	public ProjektStatus getVonStatus() {
		return vonStatus;
	}

	public void setVonStatus(ProjektStatus vonStatus) {
		this.vonStatus = vonStatus;
	}

	public ProjektStatus getNachStatus() {
		return nachStatus;
	}

	public void setNachStatus(ProjektStatus nachStatus) {
		this.nachStatus = nachStatus;
	}

	public User getGeaendertVon() {
		return geaendertVon;
	}

	public void setGeaendertVon(User geaendertVon) {
		this.geaendertVon = geaendertVon;
	}

	public Instant getZeitpunkt() {
		return zeitpunkt;
	}

	public void setZeitpunkt(Instant zeitpunkt) {
		this.zeitpunkt = zeitpunkt;
	}
}
