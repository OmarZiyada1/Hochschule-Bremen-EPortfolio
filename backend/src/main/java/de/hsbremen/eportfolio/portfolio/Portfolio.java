package de.hsbremen.eportfolio.portfolio;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;

/**
 * Oeffentliches Profil eines Benutzers. Jeder Benutzer hat hoechstens ein
 * Portfolio; das Unique auf user_id setzt das durch.
 */
@Entity
public class Portfolio extends AuditableEntity {

	@OneToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false, unique = true)
	private User user;

	@Column(columnDefinition = "text")
	private String biografie;

	@Column(length = 1024)
	private String avatarUrl;

	protected Portfolio() {
		// Von JPA benoetigt.
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	public String getBiografie() {
		return biografie;
	}

	public void setBiografie(String biografie) {
		this.biografie = biografie;
	}

	public String getAvatarUrl() {
		return avatarUrl;
	}

	public void setAvatarUrl(String avatarUrl) {
		this.avatarUrl = avatarUrl;
	}
}
