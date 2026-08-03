package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.common.enums.Role;
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
	private boolean emailVerified;

	@Column(nullable = false)
	private boolean hsbEmailVerified;

	@Column(nullable = false, length = 255)
	private String passwordHash;

	@Column(nullable = false, length = 255)
	private String firstName;

	@Column(nullable = false, length = 255)
	private String lastName;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private Role role;

	/** Entspricht dem Default der Spalte, damit ein neues Konto nie ohne Status einfuegt. */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private UserStatus status = UserStatus.REGISTRATION_PENDING;

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

	public boolean isEmailVerified() {
		return emailVerified;
	}

	public void setEmailVerified(boolean emailVerified) {
		this.emailVerified = emailVerified;
	}

	public boolean isHsbEmailVerified() {
		return hsbEmailVerified;
	}

	public void setHsbEmailVerified(boolean hsbEmailVerified) {
		this.hsbEmailVerified = hsbEmailVerified;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public void setPasswordHash(String passwordHash) {
		this.passwordHash = passwordHash;
	}

	public String getFirstName() {
		return firstName;
	}

	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	public String getLastName() {
		return lastName;
	}

	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	public Role getRole() {
		return role;
	}

	public void setRole(Role role) {
		this.role = role;
	}

	public UserStatus getStatus() {
		return status;
	}

	public void setStatus(UserStatus status) {
		this.status = status;
	}
}
