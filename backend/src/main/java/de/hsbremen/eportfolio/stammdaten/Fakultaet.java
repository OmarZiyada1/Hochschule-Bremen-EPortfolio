package de.hsbremen.eportfolio.stammdaten;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

/**
 * Fakultaet der Hochschule, etwa als Zuordnung fuer Studiengaenge und Projekte.
 */
@Entity
public class Fakultaet extends BaseEntity {

	@Column(nullable = false, length = 255)
	private String name;

	@Column(nullable = false, unique = true, length = 64)
	private String kuerzel;

	protected Fakultaet() {
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
}
