package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.User;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * Der angemeldete Benutzer, wie ihn Spring Security im SecurityContext fuehrt.
 *
 * <p>Bewusst eine eigene Klasse und nicht die {@link User}-Entity: sie ist ohne
 * JPA konstruierbar (wichtig fuer die Tests des
 * {@code ProjectPermissionService}) und traegt nur die Felder, die fuer
 * Autorisierungsentscheidungen gebraucht werden. Die {@code hsbEmail} gehoert
 * ausdruecklich nicht dazu: sie ist reines Nachweismerkmal (§3.1.1).
 */
public class AuthenticatedUser implements UserDetails {

	private final UUID id;

	/** Private E-Mail. Sie ist die Login-Kennung, nicht die HSB-Adresse. */
	private final String email;

	private final String passwordHash;

	private final Role role;

	private final UserStatus status;

	public AuthenticatedUser(UUID id, String email, String passwordHash, Role role, UserStatus status) {
		this.id = Objects.requireNonNull(id, "id");
		this.email = Objects.requireNonNull(email, "email");
		this.passwordHash = passwordHash;
		this.role = Objects.requireNonNull(role, "role");
		this.status = Objects.requireNonNull(status, "status");
	}

	public static AuthenticatedUser from(User user) {
		return new AuthenticatedUser(
				user.getId(),
				user.getEmail(),
				user.getPasswordHash(),
				user.getRole(),
				user.getStatus());
	}

	public UUID getId() {
		return id;
	}

	public Role getRole() {
		return role;
	}

	public UserStatus getStatus() {
		return status;
	}

	public boolean hasRole(Role... roles) {
		for (Role candidate : roles) {
			if (this.role == candidate) {
				return true;
			}
		}
		return false;
	}

	/** Rolle als Authority im Spring-Format, damit {@code hasRole('ADMIN')} greift. */
	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
	}

	@Override
	public String getPassword() {
		return passwordHash;
	}

	/** Der Username ist die private E-Mail (§3.1.1). */
	@Override
	public String getUsername() {
		return email;
	}

	/**
	 * Nur ein Konto mit {@code status = ACTIVE} darf sich anmelden (§2.9).
	 * REGISTRATION_PENDING und DEACTIVATED gelten als deaktiviert.
	 */
	@Override
	public boolean isEnabled() {
		return status == UserStatus.ACTIVE;
	}
}
