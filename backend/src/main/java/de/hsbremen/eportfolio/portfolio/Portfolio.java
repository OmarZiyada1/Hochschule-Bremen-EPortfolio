package de.hsbremen.eportfolio.portfolio;

import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.user.User;
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

	/**
	 * Hoechstens 500 Zeichen (§3.2, seit Contract v75). Die Laenge steht hier
	 * und nicht nur in {@code PortfolioUpdateRequest}: liefe die Spalte weiter als
	 * {@code text}, wuerde {@code ddl-auto: validate} beim Start gegen die
	 * Migration {@code V202608242020} stolpern, und die Grenze gaelte nur fuer den
	 * einen Schreibweg, der durch die Bean-Validation kommt. Vorbild ist
	 * {@link #avatarUrl} im selben Entity.
	 */
	@Column(length = 500)
	private String biography;

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

	public String getBiography() {
		return biography;
	}

	public void setBiography(String biography) {
		this.biography = biography;
	}

	public String getAvatarUrl() {
		return avatarUrl;
	}

	public void setAvatarUrl(String avatarUrl) {
		this.avatarUrl = avatarUrl;
	}
}
