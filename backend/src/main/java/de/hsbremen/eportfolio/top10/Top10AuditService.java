package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.Top10Action;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.top10.dto.Top10AuditEntryResponse;
import de.hsbremen.eportfolio.user.User;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Das unveraenderliche Aenderungsprotokoll der Top-10 (§3.17): der eine
 * Schreibweg und {@code GET /api/admin/top10-audit} aus §6.1 (KAN-45).
 *
 * <p><strong>Ein Schreibweg, vier Aufrufer.</strong> Geschrieben wird
 * ausschliesslich in {@link #record(User, List, List)}, und die Methode nimmt
 * nicht eine Aktion entgegen, sondern <em>zwei Zustaende der Liste</em> und
 * bildet die Differenz. Der Grund ist die Erfahrung, die §3.17 ausdruecklich
 * nennt: verteilte Protokollierung fuehrt zuverlaessig dazu, dass ein Pfad
 * vergessen wird. Waere die Aktion ein Parameter, muesste jeder Aufrufer selbst
 * entscheiden, ob eine Aenderung {@code ADDED}, {@code REMOVED} oder
 * {@code REORDERED} ist, und {@code PUT /api/admin/top10} muesste alle drei
 * Faelle nebeneinander behandeln. So sagt jeder Aufrufer nur, wie die Liste vor
 * und nach seinem Eingriff aussah.
 *
 * <p>Die vier Aufrufer, alle in diesem Paket beziehungsweise ueber
 * {@link Top10Service} gebuendelt (§3.17, Nachtrag Contract v28):
 * <ol>
 * <li>{@code PUT /api/admin/top10} ({@code Top10Service.setOrder}): Aufnahme,
 * Entfernung und Umsortierung in einem Zug.</li>
 * <li>die Annahme einer Nominierung ({@code Top10Service.addAt}).</li>
 * <li>der Entzug des Platzes beim Verlassen von {@code PUBLISHED}
 * ({@code Top10Service.removeOnLeavingPublished}).</li>
 * <li>das Loeschen eines Projekts, das einen Platz belegt
 * ({@code Top10Service.removeOnProjectDeletion}).</li>
 * </ol>
 *
 * <p><strong>Gelesen wird nur, nie geaendert oder geloescht.</strong> Es gibt
 * keinen schreibenden Endpoint, kein {@code DELETE} und keine
 * Korrekturmethode; die Setter der Entity sind paketprivat. Ein aenderbares
 * Protokoll beantwortet die Frage nicht mehr, fuer die es angelegt wurde
 * (§3.17).
 */
@Service
public class Top10AuditService {

	/**
	 * Sortierbare Felder von {@code GET /api/admin/top10-audit} (§6.6, ergaenzt
	 * mit Contract v28).
	 *
	 * <p>Positivliste aus demselben Grund wie in {@code ProjectReadService} und
	 * {@code AdminUserService}: ohne sie geht {@code sort} ungefiltert in eine
	 * {@code order by}-Klausel ueber beliebige Pfade des Objektmodells, ein
	 * {@code ?sort=admin.passwordHash} liesse also ueber die Reihenfolge auf ein
	 * Feld schliessen, das nach §3.1 den Server nie verlassen darf.
	 *
	 * <p>Die Liste ist bewusst nur ein Feld lang: ein Protokoll wird chronologisch
	 * gelesen. Wer nach Person oder Zeitraum einschraenken will, nimmt die Filter
	 * aus §6.1 und nicht die Sortierung.
	 */
	private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("timestamp");

	/** Standardsortierung: neueste Aenderung zuerst, wie §6.1 es festlegt. */
	private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "timestamp");

	/**
	 * Startwert der UND-Verknuepfung, wenn kein Filter gesetzt ist. Ein
	 * {@code null}-Praedikat bedeutet „keine Einschraenkung"; wie bei
	 * {@code AdminUserSpecifications} ist hier keine Sichtbarkeitsschranke der
	 * Startwert, weil es fuer diesen Endpoint keine gibt.
	 */
	private static final Specification<Top10AuditEntry> NO_RESTRICTION =
			(root, query, cb) -> null;

	private final Top10AuditEntryRepository auditRepository;

	private final ProjectPermissionService permissions;

	public Top10AuditService(Top10AuditEntryRepository auditRepository,
			ProjectPermissionService permissions) {
		this.auditRepository = auditRepository;
		this.permissions = permissions;
	}

	// ------------------------------------------------------------------
	// GET /api/admin/top10-audit
	// ------------------------------------------------------------------

	/**
	 * Das Protokoll im Seitenformat aus §6.6, neueste Aenderung zuerst.
	 *
	 * <p><strong>Warum paginiert, anders als die Nominierungsliste.</strong> §6.1
	 * fuehrt die Paginierung fuer diese Zeile ausdruecklich, und das passt zur
	 * Groessenordnung: das Protokoll waechst mit jeder Kuratierung, wird nie
	 * aufgeraeumt und schreibt bei einer vollstaendigen Umsortierung bis zu zwanzig
	 * Zeilen auf einmal.
	 *
	 * <p><strong>Alle drei Filter sind optional und werden mit UND
	 * verknuepft.</strong> Ohne Angabe kommt das vollstaendige Protokoll.
	 *
	 * @param user     angemeldete Person; die Filterkette laesst auf
	 *                 {@code /api/admin/**} nur ADMIN durch
	 * @param from     frueheste beruecksichtigte Aenderung, Grenze eingeschlossen;
	 *                 {@code null} laesst nach unten offen
	 * @param to       spaeteste beruecksichtigte Aenderung, Grenze eingeschlossen;
	 *                 {@code null} laesst nach oben offen
	 * @param adminId  Konto der handelnden Person; {@code null} liefert alle
	 * @param pageable Seite, Groesse und Sortierung
	 * @throws AccessDeniedException wenn die Rolle nicht ADMIN ist (403)
	 * @throws ValidationException   bei einem unbekannten Sortierfeld oder wenn
	 *                               {@code from} nach {@code to} liegt (400)
	 */
	@Transactional(readOnly = true)
	public PageResponse<Top10AuditEntryResponse> list(AuthenticatedUser user, Instant from,
			Instant to, UUID adminId, Pageable pageable) {

		requireAuditReader(user);
		requireOrderedRange(from, to);

		Page<Top10AuditEntry> page = auditRepository.findAll(
				conditions(from, to, adminId),
				completeSort(pageable));

		return PageResponse.from(page.map(Top10AuditEntryResponse::from));
	}

	// ------------------------------------------------------------------
	// Der einzige Schreibweg
	// ------------------------------------------------------------------

	/**
	 * Schreibt die Differenz zweier Zustaende der Top-10 ins Protokoll (§3.17).
	 *
	 * <p>Verglichen wird ueber {@link Top10Placement#projectId()}, gespeichert wird
	 * {@link Top10Placement#project()}. Die beiden fallen in genau einem Fall
	 * auseinander, beim Entzug des Platzes eines Projekts, das gerade geloescht
	 * wird: dort steht die Zeile ohne Projektverweis, siehe
	 * {@link Top10Placement#withoutProject()}.
	 *
	 * <p>Die Zuordnung, je Projekt aus beiden Listen:
	 * <ul>
	 * <li>nur in {@code after}: {@code ADDED} mit {@code newPosition}.</li>
	 * <li>nur in {@code before}: {@code REMOVED} mit {@code previousPosition}.</li>
	 * <li>in beiden, mit anderem Platz: {@code REORDERED} mit beiden
	 * Positionen.</li>
	 * <li>in beiden, mit demselben Platz: <strong>kein Eintrag</strong>. Eine
	 * Umsortierung, die ein Projekt stehen laesst, hat es nicht bewegt; eine Zeile
	 * dafuer waere Rauschen, das die tatsaechlichen Bewegungen verdeckt.</li>
	 * </ul>
	 *
	 * <p><strong>Ein Eintrag je bewegtem Projekt, kein Sammeleintrag.</strong> Das
	 * ist die Wahl, die §3.17 der Umsetzung ueberlassen hat, und sie ist mit
	 * Contract v28 dort festgehalten. Der Grund: das Protokoll soll die Frage
	 * beantworten, wer <em>dieses</em> Projekt bewegt hat. Bei einem Sammeleintrag
	 * ohne Projektbezug blieben {@code previousPosition} und {@code newPosition}
	 * dauerhaft leer, obwohl §3.17 sie fuer {@code REORDERED} vorsieht.
	 *
	 * <p><strong>Alle Zeilen eines Aufrufs tragen denselben Zeitpunkt.</strong> Sie
	 * gehoeren zu einer Entscheidung und werden nicht kuenstlich auseinandergezogen.
	 * Fuer das Blaettern folgt daraus der Gleichstandsbrecher {@code id,asc}
	 * (§6.6), ohne den dieselbe Zeile auf zwei Seiten erscheinen koennte.
	 *
	 * <p><strong>Ohne Rechtepruefung</strong>, anders als {@link #list}: diese
	 * Methode ist kein Endpoint, sondern die Nebenwirkung eines fremden. Wer den
	 * ausloesenden Eingriff durchfuehren darf, hat der aufrufende Dienst bereits
	 * geprueft; eine zweite Pruefung hier wuerde beim Entzug des Platzes durch die
	 * Redaktion sogar das Falsche verlangen, naemlich ADMIN.
	 *
	 * <p><strong>Ohne eigene Transaktion</strong>, also im Aufrufer mitlaufend. Das
	 * ist beabsichtigt: schlaegt der ausloesende Eingriff fehl, darf auch das
	 * Protokoll nichts festhalten, und umgekehrt. Ein Protokolleintrag zu einer
	 * zurueckgerollten Aenderung waere eine falsche Aussage.
	 *
	 * @param actor  wer die Aenderung veranlasst hat, nicht zwingend ein ADMIN
	 *               (§3.17)
	 * @param before besetzte Plaetze vor dem Eingriff
	 * @param after  besetzte Plaetze nach dem Eingriff
	 */
	@Transactional
	void record(User actor, List<Top10Placement> before, List<Top10Placement> after) {
		Map<UUID, Top10Placement> previousByProject = indexed(before);
		Map<UUID, Top10Placement> currentByProject = indexed(after);

		Instant now = Instant.now();
		List<Top10AuditEntry> entries = new ArrayList<>();

		// Zugaenge und Bewegungen in der Ordnung der neuen Liste, damit die
		// Eintraege eines Aufrufs bei gleichem Zeitstempel in der Reihenfolge der
		// Plaetze stehen.
		for (Top10Placement placement : after) {
			Top10Placement previous = previousByProject.get(placement.projectId());
			if (previous == null) {
				entries.add(entry(actor, placement.project(), Top10Action.ADDED, now,
						null, placement.position()));
			}
			else if (previous.position() != placement.position()) {
				entries.add(entry(actor, placement.project(), Top10Action.REORDERED, now,
						previous.position(), placement.position()));
			}
		}

		for (Top10Placement placement : before) {
			if (!currentByProject.containsKey(placement.projectId())) {
				entries.add(entry(actor, placement.project(), Top10Action.REMOVED, now,
						placement.position(), null));
			}
		}

		if (entries.isEmpty()) {
			return;
		}
		auditRepository.saveAll(entries);
		auditRepository.flush();
	}

	// ------------------------------------------------------------------
	// Pruefungen und gemeinsame Hilfsmittel
	// ------------------------------------------------------------------

	/**
	 * Zeile „Top-10-Protokoll lesen" aus §5: nur ADMIN.
	 *
	 * <p>Die Filterkette laesst auf {@code /api/admin/**} ohnehin nur ADMIN durch
	 * ({@code SecurityConfig}). Die Pruefung steht hier trotzdem, weil die
	 * Hausregel Berechtigungen zweistufig fuehrt und ein Pfadmuster keine
	 * Rechtematrix ist.
	 */
	private void requireAuditReader(AuthenticatedUser user) {
		if (!permissions.mayReadTop10Audit(user)) {
			throw new AccessDeniedException("Das Top-10-Protokoll liest ausschliesslich die "
					+ "Administration (§5).");
		}
	}

	/**
	 * Ein Zeitraum, dessen Ende vor seinem Anfang liegt, ergibt
	 * <strong>400</strong> und nicht eine leere Seite.
	 *
	 * <p>Eine leere Antwort waere hier irrefuehrend: sie sieht aus wie „in diesem
	 * Zeitraum ist nichts passiert" und ist tatsaechlich „diesen Zeitraum gibt es
	 * nicht". Die beiden Werte kommen aus derselben Eingabemaske, ein vertauschtes
	 * Paar ist deshalb der wahrscheinliche Fehler und nicht ein absichtlicher
	 * Filter.
	 */
	private static void requireOrderedRange(Instant from, Instant to) {
		if (from != null && to != null && from.isAfter(to)) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"from liegt nach to. Der Zeitraum waere leer; bitte die beiden Grenzen "
							+ "tauschen.");
		}
	}

	/** Verknuepft die gesetzten Filter mit UND. */
	private Specification<Top10AuditEntry> conditions(Instant from, Instant to, UUID adminId) {
		List<Specification<Top10AuditEntry>> parts = new ArrayList<>();

		if (from != null) {
			parts.add(Top10AuditSpecifications.from(from));
		}
		if (to != null) {
			parts.add(Top10AuditSpecifications.to(to));
		}
		if (adminId != null) {
			parts.add(Top10AuditSpecifications.admin(adminId));
		}

		return parts.stream().reduce(Specification::and).orElse(NO_RESTRICTION);
	}

	/**
	 * Prueft die gewuenschte Sortierung und ergaenzt den festen
	 * Gleichstandsbrecher, wie in {@code AdminUserService}.
	 *
	 * <p>Er ist hier kein Randfall, sondern der Regelfall: alle Zeilen eines
	 * Aufrufs von {@code PUT /api/admin/top10} tragen denselben Zeitpunkt
	 * (§3.17). Ohne eindeutige Ordnung darf die Datenbank sie zwischen zwei
	 * Abfragen unterschiedlich anordnen, und beim Blaettern erschiene dieselbe
	 * Zeile auf zwei Seiten und eine andere auf keiner.
	 */
	private Pageable completeSort(Pageable pageable) {
		Sort requested = pageable.getSort().isSorted() ? pageable.getSort() : DEFAULT_SORT;

		for (Sort.Order order : requested) {
			if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
				throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"Nach diesem Feld kann nicht sortiert werden. Erlaubt ist: "
								+ ALLOWED_SORT_FIELDS.stream().sorted()
										.collect(Collectors.joining(", "))
								+ ". Zum Einschraenken auf Person oder Zeitraum dienen die "
								+ "Filter admin, from und to.");
			}
		}

		return PageRequest.of(
				pageable.getPageNumber(),
				pageable.getPageSize(),
				requested.and(Sort.by(Sort.Direction.ASC, "id")));
	}

	/**
	 * Legt eine Zeile an. Der einzige Ort, an dem ein {@link Top10AuditEntry}
	 * entsteht; die Setter der Entity sind genau dafuer paketprivat.
	 */
	private static Top10AuditEntry entry(User actor, Project project, Top10Action action,
			Instant timestamp, Integer previousPosition, Integer newPosition) {

		Top10AuditEntry entry = new Top10AuditEntry();
		entry.setTimestamp(timestamp);
		entry.setAdmin(actor);
		entry.setProject(project);
		entry.setAction(action);
		entry.setPreviousPosition(previousPosition);
		entry.setNewPosition(newPosition);
		return entry;
	}

	/**
	 * Ordnet die Plaetze der Projekt-ID zu.
	 *
	 * <p>Ueber die ID und nicht ueber die Entity als Schluessel: {@code Project}
	 * hat kein eigenes {@code equals}, ein {@code Map<Project, ...>} haengt also
	 * an der Objektidentitaet, und die beiden Listen kommen aus verschiedenen
	 * Abfragen.
	 */
	private static Map<UUID, Top10Placement> indexed(List<Top10Placement> placements) {
		Map<UUID, Top10Placement> byProject = new HashMap<>();
		for (Top10Placement placement : placements) {
			byProject.put(placement.projectId(), placement);
		}
		return byProject;
	}
}
