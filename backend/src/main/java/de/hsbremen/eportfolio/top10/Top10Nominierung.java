package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.common.enums.NominierungStatus;
import de.hsbremen.eportfolio.projekt.Projekt;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Vorschlag, ein Projekt in die Top-10 aufzunehmen. Solange die Nominierung
 * offen ist, bleiben entschiedenVon und entschiedenAm leer.
 *
 * <p>Der Tabellenname wird wie bei {@link Top10Eintrag} explizit gesetzt.
 */
@Entity
@Table(name = "top10_nominierung")
@EntityListeners(AuditingEntityListener.class)
public class Top10Nominierung extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "projekt_id", nullable = false)
	private Projekt projekt;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "nominiert_von", nullable = false)
	private User nominiertVon;

	/** Wrapper-Typ, weil die Spalte nullable ist. */
	private Integer vorgeschlagenePosition;

	/** Entspricht dem Default der Spalte, da JPA die Spalte immer mitschreibt. */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private NominierungStatus status = NominierungStatus.OFFEN;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "entschieden_von")
	private User entschiedenVon;

	private Instant entschiedenAm;

	@CreatedDate
	@Column(nullable = false, updatable = false)
	private Instant erstelltAm;

	protected Top10Nominierung() {
		// Von JPA benoetigt.
	}

	public Projekt getProjekt() {
		return projekt;
	}

	public void setProjekt(Projekt projekt) {
		this.projekt = projekt;
	}

	public User getNominiertVon() {
		return nominiertVon;
	}

	public void setNominiertVon(User nominiertVon) {
		this.nominiertVon = nominiertVon;
	}

	public Integer getVorgeschlagenePosition() {
		return vorgeschlagenePosition;
	}

	public void setVorgeschlagenePosition(Integer vorgeschlagenePosition) {
		this.vorgeschlagenePosition = vorgeschlagenePosition;
	}

	public NominierungStatus getStatus() {
		return status;
	}

	public void setStatus(NominierungStatus status) {
		this.status = status;
	}

	public User getEntschiedenVon() {
		return entschiedenVon;
	}

	public void setEntschiedenVon(User entschiedenVon) {
		this.entschiedenVon = entschiedenVon;
	}

	public Instant getEntschiedenAm() {
		return entschiedenAm;
	}

	public void setEntschiedenAm(Instant entschiedenAm) {
		this.entschiedenAm = entschiedenAm;
	}

	public Instant getErstelltAm() {
		return erstelltAm;
	}
}
