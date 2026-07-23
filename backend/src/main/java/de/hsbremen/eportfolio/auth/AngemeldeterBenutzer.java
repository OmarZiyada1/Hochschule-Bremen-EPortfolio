package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
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
 * {@code ProjektBerechtigungService}) und traegt nur die Felder, die fuer
 * Autorisierungsentscheidungen gebraucht werden. Die {@code hsbEmail} gehoert
 * ausdruecklich nicht dazu — sie ist reines Nachweismerkmal (§3.1.1).
 */
public class AngemeldeterBenutzer implements UserDetails {

	private final UUID id;

	/** Private E-Mail. Sie ist die Login-Kennung, nicht die HSB-Adresse. */
	private final String email;

	private final String passwortHash;

	private final Rolle rolle;

	private final UserStatus status;

	public AngemeldeterBenutzer(UUID id, String email, String passwortHash, Rolle rolle, UserStatus status) {
		this.id = Objects.requireNonNull(id, "id");
		this.email = Objects.requireNonNull(email, "email");
		this.passwortHash = passwortHash;
		this.rolle = Objects.requireNonNull(rolle, "rolle");
		this.status = Objects.requireNonNull(status, "status");
	}

	public static AngemeldeterBenutzer aus(User user) {
		return new AngemeldeterBenutzer(
				user.getId(),
				user.getEmail(),
				user.getPasswortHash(),
				user.getRolle(),
				user.getStatus());
	}

	public UUID getId() {
		return id;
	}

	public Rolle getRolle() {
		return rolle;
	}

	public UserStatus getStatus() {
		return status;
	}

	public boolean hatRolle(Rolle... rollen) {
		for (Rolle kandidat : rollen) {
			if (this.rolle == kandidat) {
				return true;
			}
		}
		return false;
	}

	/** Rolle als Authority im Spring-Format, damit {@code hasRole('ADMIN')} greift. */
	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of(new SimpleGrantedAuthority("ROLE_" + rolle.name()));
	}

	@Override
	public String getPassword() {
		return passwortHash;
	}

	/** Der Username ist die private E-Mail (§3.1.1). */
	@Override
	public String getUsername() {
		return email;
	}

	/**
	 * Nur ein Konto mit {@code status = AKTIV} darf sich anmelden (§2.9).
	 * REGISTRIERUNG_OFFEN und DEAKTIVIERT gelten als deaktiviert.
	 */
	@Override
	public boolean isEnabled() {
		return status == UserStatus.AKTIV;
	}
}
