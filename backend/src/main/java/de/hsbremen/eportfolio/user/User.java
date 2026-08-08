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

	/**
	 * Erzwingt die Aenderung eines administrativ gesetzten Initialpassworts
	 * (§6.7). Solange das Flag steht, beantwortet der
	 * {@code JwtAuthenticationFilter} fast alle Endpoints mit 403. Bei selbst
	 * registrierten Konten bleibt es {@code false}: das Passwort kennt dort nur
	 * die Person selbst.
	 */
	@Column(nullable = false)
	private boolean passwordChangeRequired;

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

	/**
	 * Legt ein neues Konto an, wie es aus der Selbstregistrierung hervorgeht
	 * (§3.1.1, Schritt 2).
	 *
	 * <p>Es gibt sie, weil der Konstruktor {@code protected} bleibt: ausserhalb
	 * dieses Pakets soll niemand eine halb befuellte Entity in der Hand haben,
	 * denn jedes der sechs Felder ist {@code not null}. Bis KAN-26 loeste allein
	 * der {@code DevTestUserSeeder} das dadurch, dass er in diesem Paket liegt;
	 * das ist fuer einen Fachservice keine Loesung.
	 *
	 * <p><strong>Was die Methode bewusst nicht als Parameter nimmt:</strong> die
	 * beiden Verifizierungs-Flags und den Status. Sie stehen auf ihren
	 * Vorgabewerten, also {@code false} und {@code REGISTRATION_PENDING} (§2.9),
	 * und genau das ist der Zustand, in dem ein neues Konto zu beginnen hat. Wer
	 * ein sofort nutzbares Konto braucht, etwa der Seeder oder spaeter die
	 * Kontoanlage durch die Administration, setzt beides danach ausdruecklich.
	 *
	 * @param role aus der Domain der Hochschuladresse abgeleitet, nie aus einer
	 *             Angabe im Request (§3.1.1)
	 */
	public static User newAccount(String email, String hsbEmail, String passwordHash,
			String firstName, String lastName, Role role) {
		User user = new User();
		user.setEmail(email);
		user.setHsbEmail(hsbEmail);
		user.setPasswordHash(passwordHash);
		user.setFirstName(firstName);
		user.setLastName(lastName);
		user.setRole(role);
		return user;
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

	public boolean isPasswordChangeRequired() {
		return passwordChangeRequired;
	}

	public void setPasswordChangeRequired(boolean passwordChangeRequired) {
		this.passwordChangeRequired = passwordChangeRequired;
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
