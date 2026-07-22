package de.hsbremen.eportfolio.stammdaten;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Studiengang, der einer Fakultaet zugeordnet ist.
 */
@Entity
public class Studiengang extends BaseEntity {

	@Column(nullable = false, length = 255)
	private String name;

	@Column(length = 64)
	private String kuerzel;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "fakultaet_id", nullable = false)
	private Fakultaet fakultaet;

	protected Studiengang() {
		// Von JPA benoetigt.
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getKuerzel() {
		return kuerzel;
	}

	public void setKuerzel(String kuerzel) {
		this.kuerzel = kuerzel;
	}

	public Fakultaet getFakultaet() {
		return fakultaet;
	}

	public void setFakultaet(Fakultaet fakultaet) {
		this.fakultaet = fakultaet;
	}
}
