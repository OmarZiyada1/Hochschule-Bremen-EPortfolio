package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

/**
 * Fakultaet der Hochschule, etwa als Zuordnung fuer Studiengaenge und Projekte.
 */
@Entity
public class Faculty extends BaseEntity {

	@Column(nullable = false, length = 255)
	private String name;

	@Column(nullable = false, unique = true, length = 64)
	private String abbreviation;

	protected Faculty() {
		// Von JPA benoetigt.
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getAbbreviation() {
		return abbreviation;
	}

	public void setAbbreviation(String abbreviation) {
		this.abbreviation = abbreviation;
	}
}
