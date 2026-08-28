package de.hsbremen.eportfolio.support;

import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.SupportRequestCategory;
import de.hsbremen.eportfolio.common.enums.SupportRequestStatus;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.support.dto.SupportRequestCreateRequest;
import de.hsbremen.eportfolio.support.dto.SupportRequestResponse;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der Rueckkanal der Anwendung: Eingang und Verwaltung der Support-Anfragen
 * (§3.20, §6.1 Abschnitt „Support", KAN-85).
 *
 * <p><strong>Keine Ressourcenebene.</strong> Support ist keine Projektressource;
 * es gibt keine Autor:in, keine Zugehoerigkeit und keinen Status, an dem ein
 * Recht haengen koennte. Die Rollenebene liegt vollstaendig in der Filterkette
 * ({@code /api/admin/**} mit {@code hasRole("ADMIN")}), und ein
 * {@code may…} im {@code ProjectPermissionService} waere eine Methode ohne
 * Aussage (§5).
 */
@Service
public class SupportService {

	/**
	 * Feste Reihenfolge der Liste (§6.6): neueste zuerst, mit der Kennung als
	 * Gleichstandsbrecher.
	 *
	 * <p>Der Gleichstandsbrecher ist hier kein Randfall: mehrere Einsendungen
	 * koennen in dieselbe Sekunde fallen, und ohne eindeutige Ordnung erschiene
	 * beim Blaettern dieselbe Zeile auf zwei Seiten und eine andere auf keiner.
	 */
	private static final Sort ORDER = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id"));

	/** Obergrenze der Seitengroesse, wie ueberall in §6.6. */
	private static final int MAX_PAGE_SIZE = 100;

	private final SupportRequestRepository requestRepository;

	private final UserRepository userRepository;

	private final SupportRateLimitService rateLimit;

	/**
	 * Fuer {@code handledAt}. Als Feld und nicht als {@code Instant.now()} an
	 * der Aufrufstelle, damit ein Test den Zeitpunkt festhalten kann, ohne die
	 * Systemuhr zu befragen.
	 */
	private final Clock clock;

	/**
	 * {@code @Autowired} ist noetig, weil es zwei Konstruktoren gibt und Spring
	 * sonst nicht weiss, welchen es nehmen soll. Dasselbe Muster wie in
	 * {@link SupportRateLimitService} und {@code auth.LoginAttemptService}.
	 */
	@Autowired
	public SupportService(SupportRequestRepository requestRepository, UserRepository userRepository,
			SupportRateLimitService rateLimit) {

		this(requestRepository, userRepository, rateLimit, Clock.systemUTC());
	}

	/** Fuer Tests, die den Zeitpunkt des Statuswechsels pruefen. */
	SupportService(SupportRequestRepository requestRepository, UserRepository userRepository,
			SupportRateLimitService rateLimit, Clock clock) {

		this.requestRepository = requestRepository;
		this.userRepository = userRepository;
		this.rateLimit = rateLimit;
		this.clock = clock;
	}

	// ------------------------------------------------------------------
	// POST /api/support
	// ------------------------------------------------------------------

	/**
	 * Nimmt eine Anfrage aus dem oeffentlichen Kontaktformular entgegen (§6.1).
	 *
	 * <p>Die Reihenfolge der drei Schritte ist Absicht. <strong>Erstens</strong>
	 * die Sperre: ein gesperrter Schluessel bekommt 429, bevor irgendetwas
	 * geschieht. <strong>Zweitens</strong> das Zaehlen, und zwar fuer jede
	 * Einsendung, auch die mit gefuelltem Honeypot-Feld. <strong>Drittens</strong>
	 * das Speichern, das genau dann ausbleibt, wenn das Honeypot-Feld gefuellt
	 * ist.
	 *
	 * <p><strong>Das gefuellte Honeypot-Feld ergibt 201 und keine Zeile.</strong>
	 * Der Erfolg ist Absicht: ein Fehler verriete, dass das Feld geprueft wird,
	 * und die naechste Fassung des Programms liesse es einfach aus (§6.1).
	 *
	 * @param clientIp die tatsaechliche Verbindungsadresse, nicht ein
	 *                 {@code X-Forwarded-For}-Header (§6.5)
	 * @param userId   das angemeldete Konto oder {@code null}. Der Endpoint ist
	 *                 PUBLIC; ein Token ist erlaubt, aber nicht noetig
	 * @throws TooManySupportRequestsException wenn Adresse oder IP gesperrt sind
	 */
	@Transactional
	public void create(SupportRequestCreateRequest request, String clientIp, UUID userId) {
		if (rateLimit.isBlocked(request.email(), clientIp)) {
			throw new TooManySupportRequestsException();
		}
		rateLimit.recordAttempt(request.email(), clientIp);

		if (request.website() != null && !request.website().isBlank()) {
			return;
		}

		/*
		 * Ein Token, zu dem es kein Konto mehr gibt, laesst die Anfrage nicht
		 * scheitern: sie ist ohne Anmeldung ohnehin gueltig, und ein 404 an
		 * dieser Stelle waere die schlechteste aller Antworten fuer jemanden,
		 * der gerade ein Kontoproblem meldet. Der Verweis bleibt dann leer.
		 */
		User submittedBy = userId == null ? null : userRepository.findById(userId).orElse(null);

		requestRepository.save(SupportRequest.of(
				request.name().trim(),
				request.email().trim(),
				request.category(),
				request.subject().trim(),
				request.message().trim(),
				submittedBy));
	}

	// ------------------------------------------------------------------
	// GET /api/admin/support
	// ------------------------------------------------------------------

	/**
	 * Die Liste der Administration (§6.1), gefiltert und paginiert nach §6.6.
	 *
	 * <p><strong>Ein mitgeschickter {@code sort} wird verworfen.</strong> §6.6
	 * legt die Reihenfolge fuer diesen Endpoint fest: ein Eingangsbuch wird von
	 * hinten gelesen, und nach Name oder Adresse zu sortieren verdeckte gerade
	 * die zeitliche Naehe, an der eine Serie erkennbar ist. Der Dienst baut das
	 * {@link Pageable} deshalb neu, statt das hereingereichte durchzulassen;
	 * eine Positivliste wie bei {@code GET /projects} waere hier eine Wahl ohne
	 * Frage.
	 *
	 * @param status   optionaler Filter (§2.15), {@code null} laesst ihn weg
	 * @param category optionaler Filter (§2.14), {@code null} laesst ihn weg
	 */
	@Transactional(readOnly = true)
	public PageResponse<SupportRequestResponse> list(SupportRequestStatus status,
			SupportRequestCategory category, Pageable pageable) {

		Pageable ordered = PageRequest.of(
				pageable.getPageNumber(),
				Math.min(pageable.getPageSize(), MAX_PAGE_SIZE),
				ORDER);

		Page<SupportRequest> page = requestRepository.search(status, category, ordered);
		return PageResponse.from(page.map(SupportRequestResponse::from));
	}

	// ------------------------------------------------------------------
	// PATCH /api/admin/support/{id}
	// ------------------------------------------------------------------

	/**
	 * Setzt den Bearbeitungsstand und haelt fest, wer ihn gesetzt hat (§6.1,
	 * §2.15, §3.20).
	 *
	 * <p><strong>Die Person kommt aus dem Sicherheitskontext und nie aus dem
	 * Koerper.</strong> {@code SupportRequestStatusUpdateRequest} traegt allein
	 * {@code status} (§6.1); anders koennte ein Konto eine fremde
	 * Zustaendigkeit eintragen, und der Name gehoerte zu einem Stand, den diese
	 * Person nie gesetzt hat.
	 *
	 * <p><strong>Ein abgewiesener Uebergang schreibt nichts.</strong> Die
	 * Pruefung steht vor dem Schreiben, die Ausnahme rollt die Transaktion
	 * ohnehin zurueck; beides zusammen ist die Zusage aus §2.15.
	 *
	 * @param adminId das Konto aus dem Token; es existiert, denn ohne gueltiges
	 *                Token kommt der Aufruf nicht bis hierher
	 * @throws ResourceNotFoundException unter dieser Kennung gibt es keine
	 *                                   Anfrage
	 * @throws ConflictException         der Uebergang steht nicht in §2.15,
	 *                                   einschliesslich des erneuten Setzens des
	 *                                   bereits stehenden Werts
	 */
	@Transactional
	public SupportRequestResponse updateStatus(UUID id, SupportRequestStatus target, UUID adminId) {
		SupportRequest request = load(id);

		if (!request.getStatus().mayTransitionTo(target)) {
			throw statusTransitionInvalid(request.getStatus(), target);
		}

		/*
		 * getReferenceById statt findById: gebraucht wird allein der
		 * Fremdschluessel, und die Antwort liest Vor- und Nachnamen ueber
		 * denselben Persistenzkontext ohnehin nach. Ein voller Ladevorgang
		 * zoege Passwort-Hash und beide Adressen mit, die in dieser Antwort
		 * nichts zu suchen haben (§3.1).
		 */
		request.handle(target, userRepository.getReferenceById(adminId), Instant.now(clock));
		return SupportRequestResponse.from(request);
	}

	// ------------------------------------------------------------------
	// DELETE /api/admin/support/{id}
	// ------------------------------------------------------------------

	/**
	 * Entfernt eine Anfrage endgueltig (§6.1).
	 *
	 * <p>Kein Soft-Delete und kein Archivzustand: {@code RESOLVED} ist der
	 * Abschluss, geloescht wird, was gar nicht bleiben soll (§2.15). Ein dritter
	 * Zustand zwischen beiden haette eine Aufraeumpflicht erzeugt, die niemand
	 * uebernimmt.
	 */
	@Transactional
	public void delete(UUID id) {
		requestRepository.delete(load(id));
	}

	// ------------------------------------------------------------------

	private SupportRequest load(UUID id) {
		return requestRepository.findById(id)
				.orElseThrow(() -> new ResourceNotFoundException(ErrorCodes.RESOURCE_NOT_FOUND,
						"Support-Anfrage mit ID " + id + " existiert nicht."));
	}

	/**
	 * Die Meldung nennt den vorgefundenen Stand und die von dort erreichbaren.
	 * Beides weiss der Aufrufer in diesem Moment gerade nicht, sonst haette er
	 * den Aufruf nicht abgeschickt: der haeufigste Weg hierher ist ein zweiter
	 * Klick oder eine Liste, die den Stand noch veraltet anzeigt.
	 */
	private static ConflictException statusTransitionInvalid(SupportRequestStatus actual,
			SupportRequestStatus target) {

		StringBuilder allowed = new StringBuilder();
		for (SupportRequestStatus candidate : SupportRequestStatus.values()) {
			if (actual.mayTransitionTo(candidate)) {
				allowed.append(allowed.isEmpty() ? "" : ", ").append(candidate);
			}
		}
		return new ConflictException(ErrorCodes.SUPPORT_STATUS_TRANSITION_INVALID,
				"Der Wechsel von " + actual + " nach " + target + " ist nicht vorgesehen (§2.15). "
						+ "Von " + actual + " aus moeglich ist: " + allowed + ".");
	}

	/**
	 * Adresse oder Client-IP haben die Grenze aus §6.5 erreicht.
	 *
	 * <p>Liegt hier und nicht im {@code GlobalExceptionHandler}, wie schon die
	 * beiden Auth-Ausnahmen: sie tritt ausserhalb dieses Moduls nicht auf, und
	 * der {@code SupportController} bildet sie auf 429
	 * {@code TOO_MANY_SUPPORT_REQUESTS} ab.
	 *
	 * <p><strong>Die Meldung nennt weder Restzeit noch Zaehlerstand.</strong>
	 * Dieselbe Zurueckhaltung wie am Login (§6.5): eine genaue Auskunft waere
	 * vor allem fuer den nuetzlich, der die Grenze planvoll ausreizt.
	 */
	public static class TooManySupportRequestsException extends RuntimeException {

		public TooManySupportRequestsException() {
			super("Es sind zu viele Anfragen in kurzer Zeit eingegangen. "
					+ "Bitte spaeter erneut versuchen.");
		}
	}
}
