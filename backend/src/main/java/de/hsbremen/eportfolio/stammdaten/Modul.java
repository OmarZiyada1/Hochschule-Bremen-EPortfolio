package de.hsbremen.eportfolio.stammdaten;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Modul, das zu einem Studiengang gehoert.
 */
@Entity
public class Modul extends BaseEntity {

	@Column(nullable = false, length = 255)
	private String name;

	@Column(length = 64)
	private String kuerzel;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "studiengang_id", nullable = false)
	private Studiengang studiengang;

	protected Modul() {
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

	public Studiengang getStudiengang() {
		return studiengang;
	}

	public void setStudiengang(Studiengang studiengang) {
		this.studiengang = studiengang;
	}
}
