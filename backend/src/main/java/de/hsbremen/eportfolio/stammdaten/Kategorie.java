package de.hsbremen.eportfolio.stammdaten;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

/**
 * Kategorie, der Projekte thematisch zugeordnet werden.
 */
@Entity
public class Kategorie extends BaseEntity {

	@Column(nullable = false, unique = true, length = 255)
	private String name;

	protected Kategorie() {
		// Von JPA benoetigt.
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}
}
