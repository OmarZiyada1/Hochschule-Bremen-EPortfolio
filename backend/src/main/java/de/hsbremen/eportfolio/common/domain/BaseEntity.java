package de.hsbremen.eportfolio.common.domain;

import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import java.util.UUID;

/**
 * Basisklasse fuer alle Entities mit technischem Primaerschluessel vom Typ UUID.
 */
@MappedSuperclass
public abstract class BaseEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	public UUID getId() {
		return id;
	}
}
