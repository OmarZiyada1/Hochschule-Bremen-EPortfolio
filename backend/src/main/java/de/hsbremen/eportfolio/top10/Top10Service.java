package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectReadService;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.project.dto.ProjectCardResponse;
import de.hsbremen.eportfolio.top10.dto.Top10EntryResponse;
import de.hsbremen.eportfolio.top10.dto.Top10OrderRequest;
import de.hsbremen.eportfolio.user.User;
import de.hsbremen.eportfolio.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die kuratierte Liste selbst (§3.11): {@code GET /api/top10} und
 * {@code PUT /api/admin/top10} aus §6.1, dazu der Entzug eines Platzes, wenn ein
 * Projekt {@code PUBLISHED} verlaesst.
 *
 * <p><strong>Warum getrennt von {@link Top10NominationService}:</strong> §3.11
 * fuehrt zwei Entitaeten mit verschiedenen Aufgaben. {@code Top10Entry} ist die
 * angezeigte Liste, {@code Top10Nomination} das Vorschlags- und
 * Entscheidungsprotokoll. Die beiden beruehren sich an genau einer Stelle, beim
 * Annehmen eines Vorschlags, und das ist ein Aufruf von dort nach hier und nicht
 * umgekehrt.
 *
 * <p><strong>Positionen sind Plaetze, keine dichte Rangfolge.</strong> Faellt ein
 * Projekt aus der Liste, weil es zurueckgezogen wurde, bleibt sein Platz frei;
 * die uebrigen ruecken nicht nach. Das ist eine Entscheidung aus der
 * Klaerungsrunde zu KAN-24 und hat zwei Gruende: die Redaktion wuerde sonst durch
 * eine Ruecknahme die Reihenfolge veraendern, die der Admin kuratiert hat, und
 * ein frei gewordener Platz laesst sich anschliessend wieder gezielt vergeben.
 * Neu durchnummeriert wird ausschliesslich in {@link #setOrder}.
 *
 * <p><strong>Die Zehn wird nicht gezaehlt, sondern strukturell erzwungen.</strong>
 * Es gibt genau zehn Plaetze, jeder hoechstens einmal belegt: der
 * Check-Constraint {@code ck_top10_entry_position} laesst nur 1 bis 10 zu,
 * {@link #addAt} weist einen belegten Platz ab, und {@link #setOrder} nimmt
 * hoechstens zehn IDs entgegen. Eine elfte Zeile kann damit nicht entstehen,
 * ohne dass irgendwo eine Anzahl mitgefuehrt werden muesste.
 */
@Service
@Transactional
public class Top10Service {

	private final Top10EntryRepository entryRepository;

	private final Top10NominationRepository nominationRepository;

	private final ProjectRepository projectRepository;

	private final UserRepository userRepository;

	private final ProjectReadService readService;

	private final ProjectPermissionService permissions;

	public Top10Service(Top10EntryRepository entryRepository,
			Top10NominationRepository nominationRepository,
			ProjectRepository projectRepository,
			UserRepository userRepository,
			ProjectReadService readService,
			ProjectPermissionService permissions) {
		this.entryRepository = entryRepository;
		this.nominationRepository = nominationRepository;
		this.projectRepository = projectRepository;
		this.userRepository = userRepository;
		this.readService = readService;
		this.permissions = permissions;
	}

	// ------------------------------------------------------------------
	// GET /api/top10
	// ------------------------------------------------------------------

	/**
	 * Die oeffentliche Top-10, geordnet nach Platz (§6.1).
	 *
	 * <p><strong>Ohne Rechtepruefung und ohne angemeldete Person</strong>, wie
	 * {@code ProjectReadService.publishedCardsOfAuthor}: die Abfrage liefert
	 * ausschliesslich Eintraege zu veroeffentlichten Projekten, und die darf nach
	 * §5 jede:r lesen. Eine Sichtbarkeitsschranke haette hier nichts zu
	 * entscheiden.
	 *
	 * <p><strong>Ohne Paginierung</strong>, weil die Liste per Definition
	 * hoechstens zehn Eintraege hat. §6.1 fuehrt sie folgerichtig nicht unter den
	 * paginierten Endpoints (§6.6).
	 */
	@Transactional(readOnly = true)
	public List<Top10EntryResponse> list() {
		List<Top10Entry> entries = entryRepository.findVisible(ProjectStatus.PUBLISHED);

		List<ProjectCardResponse> cards = readService.cards(
				entries.stream().map(Top10Entry::getProject).toList());

		List<Top10EntryResponse> result = new ArrayList<>(entries.size());
		for (int i = 0; i < entries.size(); i++) {
			Top10Entry entry = entries.get(i);
			result.add(new Top10EntryResponse(entry.getPosition(), entry.getAddedAt(), cards.get(i)));
		}
		return result;
	}

	// ------------------------------------------------------------------
	// PUT /api/admin/top10
	// ------------------------------------------------------------------

	/**
	 * Setzt Bestand und Reihenfolge der Top-10 in einem Zug (§6.1, §3.11.1
	 * Regel 3): der Array-Index ist der Platz, das erste Element steht auf
	 * Platz 1.
	 *
	 * <p><strong>Alles Nichtgenannte faellt heraus.</strong> Der Endpoint ersetzt
	 * die Liste vollstaendig, es gibt kein Hinzufuegen und kein Entfernen
	 * einzelner Zeilen. Das ist der Grund, warum die Reihenfolge hier ohne
	 * Zwischenschritte konsistent bleibt: es gibt nur einen Schreibweg auf die
	 * Positionen, und der schreibt sie alle.
	 *
	 * <p><strong>{@code addedAt} bleibt stehen</strong>, solange ein Projekt in
	 * der Liste bleibt. Eine Umsortierung ist keine Aufnahme; wuerde der
	 * Zeitstempel mitwandern, hiesse „aufgenommen am" faktisch „zuletzt
	 * umsortiert am" und das Feld verloere seine Aussage (§3.11).
	 *
	 * <p><strong>Offene Nominierungen der aufgenommenen Projekte gelten als
	 * angenommen</strong> und bekommen {@code decidedBy} und {@code decidedAt}
	 * des handelnden Admins. Andernfalls stuende in der Admin-Ansicht weiter ein
	 * offener Vorschlag fuer ein Projekt, das bereits in der Liste ist, und §3.11.1
	 * Regel 2 waere verletzt; ein spaeteres {@code accept} muesste ihn dann mit 409
	 * abweisen. Entscheidung aus der Klaerungsrunde zu KAN-24.
	 *
	 * <p>Fehlerpolitik: unbekannte, doppelte oder nicht veroeffentlichte
	 * Projekt-IDs ergeben <strong>400</strong> {@code VALIDATION_FAILED}, wie es
	 * das Ticket festlegt. Ein 409 waere hier falsch: geprueft wird der Body und
	 * nicht der Zustand der Top-10.
	 *
	 * @param user    angemeldete Person; die Filterkette laesst auf
	 *                {@code /api/admin/**} nur ADMIN durch
	 * @param request die gewuenschte Liste
	 * @throws AccessDeniedException wenn die Rolle nicht ADMIN ist (403)
	 * @throws ValidationException   bei unbekannten, doppelten oder nicht
	 *                               veroeffentlichten Projekten (400)
	 */
	public List<Top10EntryResponse> setOrder(AuthenticatedUser user, Top10OrderRequest request) {
		requireCurator(user);

		List<UUID> projectIds = requireDistinct(request.projectIds());
		Map<UUID, Project> projects = loadPublished(projectIds);

		Map<UUID, Top10Entry> existing = new HashMap<>();
		for (Top10Entry entry : entryRepository.findAllByOrderByPositionAsc()) {
			existing.put(entry.getProject().getId(), entry);
		}

		Instant now = Instant.now();
		List<Top10Entry> kept = new ArrayList<>(projectIds.size());
		for (int index = 0; index < projectIds.size(); index++) {
			UUID projectId = projectIds.get(index);
			Top10Entry entry = existing.remove(projectId);
			if (entry == null) {
				entry = new Top10Entry();
				entry.setProject(projects.get(projectId));
				entry.setAddedAt(now);
			}
			entry.setPosition(index + 1);
			kept.add(entry);
		}

		// Was in der Karte uebrig bleibt, stand vorher in der Liste und ist
		// jetzt nicht mehr genannt.
		//
		// Geloescht wird vor dem Schreiben und mit eigenem flush, obwohl die
		// beiden Mengen sich nicht ueberschneiden koennen: eine Projekt-ID wird
		// entweder oben aus der Karte genommen und wiederverwendet oder sie
		// bleibt drin und faellt weg, nie beides. Die Reihenfolge steht
		// trotzdem ausdruecklich da, weil Hibernate von sich aus erst einfuegt
		// und dann loescht; sollte die Zuordnung oben je anders geschnitten
		// werden, liefe sie sonst in den Unique-Constraint auf project_id.
		entryRepository.deleteAll(existing.values());
		entryRepository.flush();
		entryRepository.saveAll(kept);
		entryRepository.flush();

		closeOpenNominations(user, projectIds, now);

		return list();
	}

	// ------------------------------------------------------------------
	// Aufnahme ueber eine angenommene Nominierung
	// ------------------------------------------------------------------

	/**
	 * Setzt ein Projekt auf einen bestimmten Platz. Aufgerufen aus
	 * {@link Top10NominationService#accept}, wenn ein Vorschlag angenommen wird.
	 *
	 * <p><strong>Der Platz muss frei sein.</strong> Ist er belegt, folgt
	 * <strong>409</strong> {@code RESOURCE_IN_USE} und nichts wird veraendert. Der
	 * Alternativweg, das dort stehende Projekt zu verdraengen, ist in der
	 * Klaerungsrunde zu KAN-24 verworfen worden: ein Projekt verschwaende dann aus
	 * der Top-10, ohne dass jemand das entschieden haette. Wer umsortieren will,
	 * nimmt {@link #setOrder}.
	 *
	 * <p>Damit ist auch die volle Liste abgedeckt: stehen zehn Eintraege, ist
	 * jeder der zehn Plaetze belegt, und jede Position endet in derselben
	 * Antwort. Eine eigene Zaehlung braucht es dafuer nicht.
	 *
	 * @param project  das aufzunehmende Projekt, bereits als {@code PUBLISHED}
	 *                 geprueft
	 * @param position Platz 1 bis 10, bereits durch Bean-Validation begrenzt
	 * @throws ConflictException wenn der Platz belegt ist oder das Projekt bereits
	 *                           in der Liste steht (409)
	 */
	void addAt(Project project, int position) {
		if (entryRepository.existsByProjectId(project.getId())) {
			throw ConflictException.resourceInUse(
					"Dieses Projekt steht bereits in der Top-10 (§3.11.1).");
		}
		if (entryRepository.existsByPosition(position)) {
			throw ConflictException.resourceInUse(
					"Platz " + position + " der Top-10 ist bereits belegt. Bitte einen freien "
							+ "Platz waehlen oder die Liste ueber PUT /api/admin/top10 neu setzen.");
		}

		Top10Entry entry = new Top10Entry();
		entry.setProject(project);
		entry.setPosition(position);
		entry.setAddedAt(Instant.now());
		entryRepository.saveAndFlush(entry);
	}

	// ------------------------------------------------------------------
	// Entzug beim Verlassen von PUBLISHED
	// ------------------------------------------------------------------

	/**
	 * Nimmt ein Projekt aus der Top-10, sobald es {@code PUBLISHED} verlaesst.
	 * Aufgerufen aus {@code ProjectWorkflowService} bei jedem Statusuebergang;
	 * nach §4.1 ist das heute allein die Ruecknahme nach {@code REVISION}.
	 *
	 * <p><strong>Warum entfernen und nicht nur ausblenden.</strong> Beides haette
	 * die Startseite sauber gehalten. Entschieden wurde in der Klaerungsrunde zu
	 * KAN-24 fuer das Entfernen, weil ein zurueckgezogenes Projekt seinen Platz
	 * sonst blockierte, ohne dort zu erscheinen: der Admin saehe einen belegten
	 * Platz, die Oeffentlichkeit eine Luecke, und niemand koennte den Platz neu
	 * vergeben, ohne den unsichtbaren Eintrag erst zu suchen.
	 *
	 * <p><strong>Der freie Platz bleibt frei.</strong> Die uebrigen Eintraege
	 * ruecken nicht nach, siehe Klassenkommentar.
	 *
	 * <p><strong>Die Nominierung bleibt unberuehrt.</strong> Sie ist Protokoll:
	 * dass ein Vorschlag angenommen wurde, bleibt wahr, auch wenn das Projekt
	 * spaeter zurueckgezogen wird (§3.11). Eine erneute Aufnahme nach der
	 * Wiederveroeffentlichung ist eine neue Entscheidung und braucht eine neue
	 * Nominierung oder ein {@link #setOrder}.
	 *
	 * @param project das Projekt, dessen Status sich gerade geaendert hat
	 */
	public void removeOnLeavingPublished(Project project) {
		if (project.getStatus() == ProjectStatus.PUBLISHED) {
			return;
		}
		entryRepository.deleteByProjectId(project.getId());
	}

	// ------------------------------------------------------------------
	// Pruefungen und gemeinsame Hilfsmittel
	// ------------------------------------------------------------------

	/**
	 * Zeile „Top-10 kuratieren" aus §5: nur ADMIN.
	 *
	 * <p>Die Filterkette laesst auf {@code /api/admin/**} ohnehin nur ADMIN durch
	 * ({@code SecurityConfig}). Die Pruefung steht hier trotzdem, weil die
	 * Hausregel Berechtigungen zweistufig fuehrt und der Dienst auch fuer sich
	 * genommen die richtige Antwort geben soll; ohne sie hinge das Recht allein
	 * an einem Pfadmuster.
	 */
	private void requireCurator(AuthenticatedUser user) {
		if (!permissions.mayCurateTop10(user)) {
			throw new AccessDeniedException("Die Top-10 kuratiert ausschliesslich die "
					+ "Administration (§5).");
		}
	}

	/**
	 * Weist eine Liste mit Wiederholungen ab.
	 *
	 * <p>Ohne diese Pruefung bekaeme dasselbe Projekt zwei Plaetze zugewiesen, von
	 * denen der Unique-Constraint auf {@code project_id} nur einen zulaesst: der
	 * Aufruf endete in einem 500 statt in einer verstaendlichen Antwort. Ein
	 * stilles Entdoppeln waere die schlechtere Alternative: die Plaetze aller
	 * nachfolgenden Projekte verschoeben sich dann gegenueber dem, was der Client
	 * geschickt hat, ohne dass er davon erfaehrt.
	 */
	private List<UUID> requireDistinct(List<UUID> projectIds) {
		if (new LinkedHashSet<>(projectIds).size() != projectIds.size()) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"In projectIds steht mindestens ein Projekt mehrfach. Jedes Projekt belegt "
							+ "genau einen Platz.");
		}
		return projectIds;
	}

	/**
	 * Laedt die genannten Projekte und stellt sicher, dass es sie gibt und dass
	 * sie veroeffentlicht sind (§3.11.1 Regel 1).
	 *
	 * <p>Beide Verstoesse ergeben <strong>400</strong> und nicht 404
	 * beziehungsweise 409: die IDs stehen im Body und adressieren keine Ressource,
	 * dieser Endpoint spricht die Top-10 an. Dieselbe Ueberlegung wie bei den
	 * Filter-IDs von {@code GET /api/projects}, nur mit umgekehrtem Ergebnis: dort
	 * ist eine unbekannte ID belanglos und filtert nichts, hier soll sie einen
	 * Platz belegen.
	 *
	 * <p>Die Meldung nennt die beanstandeten IDs. Der Aufrufer hat sie selbst
	 * geschickt, und ohne sie muesste er bei zehn Eintraegen raten, welcher nicht
	 * passt.
	 */
	private Map<UUID, Project> loadPublished(List<UUID> projectIds) {
		if (projectIds.isEmpty()) {
			return Map.of();
		}

		Map<UUID, Project> found = new HashMap<>();
		for (Project project : projectRepository.findAllById(projectIds)) {
			found.put(project.getId(), project);
		}

		List<UUID> unknown = projectIds.stream().filter(id -> !found.containsKey(id)).toList();
		if (!unknown.isEmpty()) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"Diese Projekte gibt es nicht: " + join(unknown) + ".");
		}

		List<UUID> notPublished = projectIds.stream()
				.filter(id -> found.get(id).getStatus() != ProjectStatus.PUBLISHED)
				.toList();
		if (!notPublished.isEmpty()) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"In die Top-10 kommen nur veroeffentlichte Projekte (§3.11.1). Nicht "
							+ "veroeffentlicht: " + join(notPublished) + ".");
		}

		return found;
	}

	/**
	 * Schliesst die offenen Nominierungen der eben aufgenommenen Projekte ab,
	 * siehe {@link #setOrder}.
	 */
	private void closeOpenNominations(AuthenticatedUser user, List<UUID> projectIds, Instant now) {
		if (projectIds.isEmpty()) {
			return;
		}

		List<Top10Nomination> open = nominationRepository.findByStatusAndProjectIdIn(
				NominationStatus.PENDING, projectIds);
		if (open.isEmpty()) {
			return;
		}

		User admin = currentUser(user);
		for (Top10Nomination nomination : open) {
			nomination.setStatus(NominationStatus.ACCEPTED);
			nomination.setDecidedBy(admin);
			nomination.setDecidedAt(now);
		}
		nominationRepository.saveAll(open);
	}

	/**
	 * Die angemeldete Person als Entity, wie in
	 * {@code ProjectWorkflowService.currentUser}: {@code AuthenticatedUser} traegt
	 * nur die Felder fuer Autorisierungsentscheidungen, fuer einen Fremdschluessel
	 * braucht es die Zeile.
	 */
	private User currentUser(AuthenticatedUser user) {
		return userRepository.findById(user.getId()).orElseThrow(() -> new AccessDeniedException(
				"Das angemeldete Konto existiert nicht mehr."));
	}

	private static String join(List<UUID> ids) {
		return ids.stream().map(UUID::toString).reduce((a, b) -> a + ", " + b).orElse("");
	}
}
