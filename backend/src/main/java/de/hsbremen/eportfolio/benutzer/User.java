package de.hsbremen.eportfolio.benutzer;

import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Benutzerkonto der Anwendung. Liegt auf der Tabelle app_user, weil "user" in
 * Postgres ein reserviertes Wort ist.
 *
 * <p>Ein Konto fuehrt zwei E-Mail-Adressen: {@code email} ist die private
 * Adresse und zugleich die Login-Kennung, {@code hsbEmail} weist die
 * Zugehoerigkeit zur Hochschule nach. Beide werden getrennt verifiziert.
 */
@Entity
@Table(name = "app_user")
public class User extends AuditableEntity {

	@Column(nullable = false, unique = true, length = 255)
	private String email;

	@Column(nullable = false, unique = true, length = 255)
	private String hsbEmail;

	@Column(nullable = false)
	private boolean emailVerifiziert;

	@Column(nullable = false)
	private boolean hsbEmailVerifiziert;

	@Column(nullable = false, length = 255)
	private String passwortHash;

	@Column(nullable = false, length = 255)
	private String vorname;

	@Column(nullable = false, length = 255)
	private String nachname;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private Rolle rolle;

	/** Entspricht dem Default der Spalte, damit ein neues Konto nie ohne Status einfuegt. */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private UserStatus status = UserStatus.REGISTRIERUNG_OFFEN;

	protected User() {
		// Von JPA benoetigt.
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getHsbEmail() {
		return hsbEmail;
	}

	public void setHsbEmail(String hsbEmail) {
		this.hsbEmail = hsbEmail;
	}

	public boolean isEmailVerifiziert() {
		return emailVerifiziert;
	}

	public void setEmailVerifiziert(boolean emailVerifiziert) {
		this.emailVerifiziert = emailVerifiziert;
	}

	public boolean isHsbEmailVerifiziert() {
		return hsbEmailVerifiziert;
	}

	public void setHsbEmailVerifiziert(boolean hsbEmailVerifiziert) {
		this.hsbEmailVerifiziert = hsbEmailVerifiziert;
	}

	public String getPasswortHash() {
		return passwortHash;
	}

	public void setPasswortHash(String passwortHash) {
		this.passwortHash = passwortHash;
	}

	public String getVorname() {
		return vorname;
	}

	public void setVorname(String vorname) {
		this.vorname = vorname;
	}

	public String getNachname() {
		return nachname;
	}

	public void setNachname(String nachname) {
		this.nachname = nachname;
	}

	public Rolle getRolle() {
		return rolle;
	}

	public void setRolle(Rolle rolle) {
		this.rolle = rolle;
	}

	public UserStatus getStatus() {
		return status;
	}

	public void setStatus(UserStatus status) {
		this.status = status;
	}
}
