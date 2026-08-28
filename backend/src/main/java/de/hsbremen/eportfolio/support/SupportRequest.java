package de.hsbremen.eportfolio.support;

import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.common.enums.SupportRequestCategory;
import de.hsbremen.eportfolio.common.enums.SupportRequestStatus;
import de.hsbremen.eportfolio.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Eine ueber das oeffentliche Kontaktformular eingegangene Anfrage (§3.20).
 *
 * <p><strong>Bis auf {@code status} unveraenderlich.</strong> Es gibt keinen
 * Setter fuer {@code name}, {@code email}, {@code category}, {@code subject}
 * oder {@code message} und keinen Endpoint, der sie aendert, auch nicht fuer
 * ADMIN (§6.1). Ein Eingangsbuch, in dem sich der Eingang umschreiben laesst,
 * waere keines. Wer eine Anfrage nicht behalten will, loescht sie ganz.
 */
@Entity
public class SupportRequest extends AuditableEntity {

	@Column(nullable = false, length = 120)
	private String name;

	@Column(nullable = false, length = 255)
	private String email;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private SupportRequestCategory category;

	@Column(nullable = false, length = 160)
	private String subject;

	@Column(columnDefinition = "text", nullable = false)
	private String message;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private SupportRequestStatus status;

	/**
	 * Das absendende Konto, sofern angemeldet; sonst {@code null}.
	 *
	 * <p>Der wichtigste Fall des Formulars ist die Person, die sich gerade nicht
	 * anmelden kann, deshalb ist das Feld bewusst optional. Es erscheint in
	 * keiner Ansicht, die dieses Ticket baut; ohne die Spalte liesse sich
	 * spaeter aber nicht mehr feststellen, ob hinter einer Anfrage ein Konto
	 * steht, denn die Adresse allein sagt es nicht (§3.20).
	 */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "submitted_by_user_id")
	private User submittedBy;

	protected SupportRequest() {
		// Von JPA benoetigt.
	}

	/**
	 * Eine neue Anfrage im Eingang (§3.20).
	 *
	 * <p><strong>Warum eine benannte Fabrik</strong> und kein oeffentlicher
	 * Konstruktor: der Anfangsstatus gehoert zur Anlage und ist keine Wahl des
	 * Aufrufers. Jede Anfrage beginnt als {@link SupportRequestStatus#OPEN}
	 * (§2.15); ein Parameter dafuer waere die Einladung, sie gleich als erledigt
	 * einzutragen.
	 *
	 * @param submittedBy das absendende Konto oder {@code null}, wenn die
	 *                    Anfrage ohne Anmeldung kam
	 */
	public static SupportRequest of(String name, String email, SupportRequestCategory category,
			String subject, String message, User submittedBy) {

		SupportRequest request = new SupportRequest();
		request.name = name;
		request.email = email;
		request.category = category;
		request.subject = subject;
		request.message = message;
		request.status = SupportRequestStatus.OPEN;
		request.submittedBy = submittedBy;
		return request;
	}

	public String getName() {
		return name;
	}

	public String getEmail() {
		return email;
	}

	public SupportRequestCategory getCategory() {
		return category;
	}

	public String getSubject() {
		return subject;
	}

	public String getMessage() {
		return message;
	}

	public SupportRequestStatus getStatus() {
		return status;
	}

	/**
	 * Setzt den Bearbeitungsstand. Ob der Uebergang erlaubt ist, entscheidet
	 * {@link SupportRequestStatus#mayTransitionTo}; geprueft wird das im
	 * {@link SupportService}, damit die Ausnahme mit dem Fehlercode aus §6.2 an
	 * der Stelle entsteht, die den Contract kennt.
	 */
	public void setStatus(SupportRequestStatus status) {
		this.status = status;
	}

	public User getSubmittedBy() {
		return submittedBy;
	}
}
