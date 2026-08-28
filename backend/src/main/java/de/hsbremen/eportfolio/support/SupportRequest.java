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
import java.time.Instant;

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

	/**
	 * Das Admin-Konto, das den {@link #status} zuletzt gesetzt hat (§3.20, seit
	 * Contract v88). Leer, solange die Anfrage unberuehrt im Eingang liegt.
	 *
	 * <p><strong>Ein Feld beantwortet beide Fragen, und der Status sagt
	 * welche.</strong> Bei {@code IN_PROGRESS} ist es die Person, die sich der
	 * Anfrage angenommen hat, bei {@code RESOLVED} die, die sie erledigt hat,
	 * und bei einem wieder geoeffneten {@code OPEN} die, die sie zurueckgeholt
	 * hat. Zwei getrennte Felder waeren die genauere Auskunft, haetten aber
	 * eine Aufraeumregel je Uebergang gebraucht.
	 */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "handled_by_user_id")
	private User handledBy;

	/**
	 * Zeitpunkt dieses Statuswechsels. Immer zusammen mit {@link #handledBy}
	 * gesetzt oder zusammen leer; die Datenbank haelt das mit
	 * {@code ck_support_request_handled} fest.
	 */
	@Column(name = "handled_at")
	private Instant handledAt;

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
	 * Setzt den Bearbeitungsstand und haelt fest, wer ihn gesetzt hat (§2.15,
	 * §3.20).
	 *
	 * <p>Ob der Uebergang erlaubt ist, entscheidet
	 * {@link SupportRequestStatus#mayTransitionTo}; geprueft wird das im
	 * {@link SupportService}, damit die Ausnahme mit dem Fehlercode aus §6.2 an
	 * der Stelle entsteht, die den Contract kennt. Ein abgewiesener Uebergang
	 * kommt hier gar nicht an und schreibt deshalb auch nichts.
	 *
	 * <p><strong>Stand und Person werden gemeinsam gesetzt und nicht einzeln.</strong>
	 * Ein Setter je Feld waere die Einladung, den einen ohne den anderen zu
	 * aendern, und genau das darf nicht sein: ein Stand ohne Namen liesse die
	 * Liste raten, ein Name ohne Stand gehoerte zu nichts.
	 *
	 * @param handledBy das Admin-Konto aus dem Sicherheitskontext, nie ein Wert
	 *                  aus dem Anfragekoerper (§6.1)
	 */
	public void handle(SupportRequestStatus status, User handledBy, Instant handledAt) {
		this.status = status;
		this.handledBy = handledBy;
		this.handledAt = handledAt;
	}

	public User getSubmittedBy() {
		return submittedBy;
	}

	public User getHandledBy() {
		return handledBy;
	}

	public Instant getHandledAt() {
		return handledAt;
	}
}
