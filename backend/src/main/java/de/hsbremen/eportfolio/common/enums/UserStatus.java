package de.hsbremen.eportfolio.common.enums;

/**
 * Status eines Benutzerkontos. Ein Konto gilt erst als aktiv, wenn sowohl die
 * private als auch die HSB-E-Mail-Adresse verifiziert sind.
 */
public enum UserStatus {
	REGISTRATION_PENDING,
	ACTIVE,
	DEACTIVATED
}
