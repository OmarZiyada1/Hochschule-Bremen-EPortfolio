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
 *
 * <p><strong>Jede Aenderung an der Liste laeuft durch
 * {@link Top10AuditService#record}</strong> (§3.17, KAN-45). Drei der vier
 * Schreibwege aus dem Nachtrag zu Contract v28 liegen in dieser Klasse
 * ({@link #setOrder}, {@link #addAt}, {@link #removeOnLeavingPublished}), der
 * vierte ist {@link #removeOnProjectDeletion} und wird aus
 * {@code ProjectWriteService.delete} gerufen. Die Protokollmethode bekommt
 * jeweils nur den Vorher- und den Nachher-Zustand und leitet die Aktion selbst
 * ab; keine dieser Methoden entscheidet ueber {@code ADDED}, {@code REMOVED}
 * oder {@code REORDERED}.
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

	private final Top10AuditService auditService;

	public Top10Service(Top10EntryRepository entryRepository,
			Top10NominationRepository nominationRepository,
			ProjectRepository projectRepository,
			UserRepository userRepository,
			ProjectReadService readService,
			ProjectPermissionService permissions,
			Top10AuditService auditService) {
		this.entryRepository = entryRepository;
		this.nominationRepository = nominationRepository;
		this.projectRepository = projectRepository;
		this.userRepository = userRepository;
		this.readService = readService;
		this.permissions = permissions;
		this.auditService = auditService;
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
		List<Top10Placement> before = new ArrayList<>();
		for (Top10Entry entry : entryRepository.findAllByOrderByPositionAsc()) {
			existing.put(entry.getProject().getId(), entry);
			// Vor der Schleife unten festgehalten, weil sie die Plaetze der
			// wiederverwendeten Eintraege ueberschreibt. Das Record kopiert die
			// Position als int, der Vorzustand kann danach nicht mehr wandern.
			before.add(Top10Placement.of(entry));
		}

		Instant now = Instant.now();
		List<Top10Entry> kept = new ArrayList<>(projectIds.size());
		List<Top10Placement> after = new ArrayList<>(projectIds.size());
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
			after.add(Top10Placement.of(entry));
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

		User admin = currentUser(user);
		auditService.record(admin, before, after);
		closeOpenNominations(admin, projectIds, now);

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
	 * <p><strong>Protokolliert als {@code ADDED}</strong> (§3.17). Der Vorzustand
	 * ist leer und der Nachzustand dieser eine Platz; die Protokollmethode leitet
	 * daraus die Aktion ab, diese Methode nennt sie nicht.
	 *
	 * @param project  das aufzunehmende Projekt, bereits als {@code PUBLISHED}
	 *                 geprueft
	 * @param position Platz 1 bis 10, bereits durch Bean-Validation begrenzt
	 * @param admin    entscheidende:r Admin, fuer das Protokoll
	 * @throws ConflictException wenn der Platz belegt ist oder das Projekt bereits
	 *                           in der Liste steht (409)
	 */
	void addAt(Project project, int position, User admin) {
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

		auditService.record(admin, List.of(), List.of(Top10Placement.of(entry)));
	}

	// ------------------------------------------------------------------
	// Entzug beim Verlassen von PUBLISHED
	// ------------------------------------------------------------------

	/**
	 * Nimmt ein Projekt aus der Top-10, sobald es {@code PUBLISHED} verlaesst.
	 * Aufgerufen aus {@code ProjectWorkflowService} bei jedem Statusuebergang.
	 *
	 * <p><strong>Seit Contract v72 kann dieser Weg nicht mehr ausloesen.</strong>
	 * Der einzige Uebergang aus {@code PUBLISHED} ist die Ruecknahme nach
	 * {@code REVISION}, und beide Ausloeser sperren sie, solange das Projekt
	 * einen Platz belegt: {@code requireNotInTop10} am ausdruecklichen Weg und
	 * {@code holdsSeat} am Kommentarweg. {@link #releaseSeat} findet hier also
	 * keinen Eintrag mehr. Die Methode bleibt trotzdem stehen, und zwar
	 * bewusst: §3.17 fuehrt den Schreibweg weiter, und ein kuenftiger
	 * Uebergang aus {@code PUBLISHED} heraus faende die Aufraeumung schon vor,
	 * statt sie zu vergessen. Wer sie entfernt, streicht auch den Weg aus
	 * §3.17 und aus {@code docs/ARCHITEKTUR.md} Kapitel 13.
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
	 * <p><strong>Protokolliert als {@code REMOVED}</strong>, seit Contract v28
	 * (§3.17). Bis dahin nannte §3.17 nur die beiden Admin-Wege als Schreibwege
	 * des Protokolls. Das war zu wenig: ein Projekt verliess die Liste, ohne dass
	 * das Protokoll davon wusste, und gerade die Frage „welcher Platz war wann
	 * durch welches Projekt belegt" liess sich damit nicht beantworten. Die
	 * handelnde Person ist hier die Redaktion und nicht die Administration; das
	 * Feld {@code adminId} haelt deshalb ausdruecklich die veranlassende Person und
	 * nicht zwingend einen Admin.
	 *
	 * @param project das Projekt, dessen Status sich gerade geaendert hat
	 * @param actor   wer den Statuswechsel ausgeloest hat, fuer das Protokoll
	 */
	public void removeOnLeavingPublished(Project project, User actor) {
		if (project.getStatus() == ProjectStatus.PUBLISHED) {
			return;
		}
		releaseSeat(project, actor, true);
	}

	// ------------------------------------------------------------------
	// Entzug beim Loeschen des Projekts
	// ------------------------------------------------------------------

	/**
	 * Protokolliert den frei werdenden Platz, <strong>bevor</strong> ein Projekt
	 * geloescht wird. Aufgerufen aus {@code ProjectWriteService.delete} (§6.1).
	 *
	 * <p><strong>Warum es diesen vierten Schreibweg gibt.</strong> Die Zeile in
	 * {@code top10_entry} raeumt die Datenbank ueber {@code on delete cascade}
	 * selbst ab, ohne dass eine Zeile Java-Code davon erfaehrt. Ohne diesen Aufruf
	 * verschwaende ein Projekt also lautlos aus der kuratierten Liste, und das
	 * Protokoll endete beim vorherigen Eintrag. Entschieden in der Klaerungsrunde
	 * zu KAN-45, nachgetragen in §3.17 mit Contract v28.
	 *
	 * <p><strong>Die Zeile entsteht ohne Projektverweis.</strong> Der
	 * Fremdschluessel steht auf {@code on delete set null}, der Verweis waere mit
	 * dem Commit also ohnehin leer; ihn zu setzen wuerde ausserdem den ganzen
	 * Loeschvorgang zum Scheitern bringen, siehe
	 * {@link Top10Placement#withoutProject()}. Was bleibt, ist die Aussage, auf die
	 * es hier ankommt: zu diesem Zeitpunkt hat diese Person diesen Platz
	 * freigeraeumt. Ein Titel-Schnappschuss ist bewusst nicht mitgeschrieben
	 * worden, er fuehrte eine Angabe, die niemand mehr pruefen kann (§3.17).
	 *
	 * <p><strong>Aeltere Zeilen zu demselben Projekt behalten mehr:</strong> sie
	 * verlieren beim Loeschen ebenfalls ihren Verweis, standen aber mit ihm in der
	 * Datenbank und sind der Grund fuer das {@code on delete set null}.
	 *
	 * <p><strong>Ohne Statuspruefung</strong>, anders als
	 * {@link #removeOnLeavingPublished}: geloescht wird nach §6.1 im Entwurf durch
	 * die Autor:in und in jedem Status durch den Admin. Einen Platz belegt dabei
	 * ohnehin nur ein veroeffentlichtes Projekt.
	 *
	 * @param project das Projekt, das gleich geloescht wird
	 * @param actor   wer das Loeschen ausgeloest hat, fuer das Protokoll
	 */
	public void removeOnProjectDeletion(Project project, User actor) {
		releaseSeat(project, actor, false);
	}

	// ------------------------------------------------------------------
	// Auskunft und Aufraeumen fuer den Zustandsautomaten
	// ------------------------------------------------------------------

	/**
	 * Steht dieses Projekt gerade in der kuratierten Liste (§3.11)?
	 *
	 * <p>Gefragt wird das seit Contract v72 vor dem Uebergang nach
	 * {@code REVISION}: solange das Projekt einen Platz belegt, ist der Weg
	 * gesperrt (§4.1). Bis v71 war es umgekehrt, der Uebergang entzog den Platz
	 * still mit; damit gab er der Redaktion die Startseite in die Hand, obwohl
	 * die nach §5 allein der Administration gehoert.
	 *
	 * <p>Gefragt wird der Bestand <em>jetzt</em> und nicht die Vorgeschichte:
	 * ein Projekt, das die Liste laengst wieder verlassen hat, ist nicht
	 * gesperrt.
	 */
	public boolean holdsSeat(Project project) {
		return entryRepository.existsByProjectId(project.getId());
	}

	/**
	 * Zieht die offenen Nominierungen eines Projekts zurueck, weil es
	 * {@code PUBLISHED} verlaesst (§3.11.1, seit Contract v72).
	 *
	 * <p><strong>Warum sie nicht stehenbleiben duerfen.</strong> Annehmen
	 * liesse sich ein nicht veroeffentlichtes Projekt nach Regel 1 ohnehin
	 * nicht; offen sperrte der Vorschlag es nach Regel 2 aber zugleich gegen
	 * jeden neuen. Er waere also unerfuellbar und im Weg zugleich.
	 *
	 * <p><strong>Angenommene bleiben unberuehrt.</strong> Dass ein Vorschlag
	 * angenommen wurde, bleibt wahr, auch wenn das Projekt die Liste spaeter
	 * verlaesst (§3.11). Das Protokoll wird nicht rueckwirkend umgeschrieben.
	 *
	 * @param actor wer den Statuswechsel ausgeloest hat; er steht danach als
	 *              {@code decidedBy} an den zurueckgezogenen Vorschlaegen
	 */
	public void withdrawOpenNominations(Project project, User actor) {
		List<Top10Nomination> open = nominationRepository.findByStatusAndProjectIdIn(
				NominationStatus.PENDING, List.of(project.getId()));
		if (open.isEmpty()) {
			return;
		}

		Instant now = Instant.now();
		for (Top10Nomination nomination : open) {
			nomination.setStatus(NominationStatus.WITHDRAWN);
			nomination.setDecidedBy(actor);
			nomination.setDecidedAt(now);
		}
		nominationRepository.saveAll(open);
		nominationRepository.flush();
	}

	// ------------------------------------------------------------------
	// Entzug beim Zurueckziehen einer angenommenen Nominierung
	// ------------------------------------------------------------------

	/**
	 * Nimmt ein Projekt aus der Top-10, weil die Administration die Nominierung
	 * zurueckzieht, ueber die es aufgenommen wurde (§3.11.1, seit Contract v70).
	 * Aufgerufen aus {@link Top10NominationService#withdraw}.
	 *
	 * <p><strong>Der fuenfte Schreibweg des Protokolls</strong> (§3.17), nach
	 * {@link #setOrder}, {@link #addAt}, {@link #removeOnLeavingPublished} und
	 * {@link #removeOnProjectDeletion}. Ohne ihn verloere ein Projekt seinen
	 * Platz, ohne dass das Protokoll davon wuesste, und genau das war der Grund
	 * fuer die beiden Wege aus Contract v28.
	 *
	 * <p><strong>Auch dieser Platz bleibt frei</strong>, die uebrigen Eintraege
	 * ruecken nicht nach; siehe Klassenkommentar.
	 *
	 * <p><strong>Ohne Statuspruefung</strong>, anders als
	 * {@link #removeOnLeavingPublished}: das Projekt ist zu diesem Zeitpunkt
	 * veroeffentlicht, sonst stuende es nicht in der Liste, und ob es das noch
	 * ist, spielt fuer den Entzug keine Rolle. Belegt es keinen Platz, geschieht
	 * nichts.
	 *
	 * @param project das Projekt der zurueckgezogenen Nominierung
	 * @param admin   wer zurueckzieht; bei diesem Weg immer ein Admin, weil nur
	 *                die Administration einen angenommenen Vorschlag
	 *                zurueckziehen darf (§5)
	 */
	void removeOnWithdrawnNomination(Project project, User admin) {
		releaseSeat(project, admin, true);
	}

	/**
	 * Gibt einen Platz frei und schreibt genau eine Protokollzeile, sofern das
	 * Projekt ueberhaupt einen belegt hat.
	 *
	 * <p>Gemeinsamer Rumpf der beiden Entzugswege. Die Abfrage ersetzt das
	 * fruehere {@code deleteByProjectId}: fuer das Protokoll muss der Platz
	 * bekannt sein, den das Projekt gerade verliert, und ein Loeschen nach
	 * Fremdschluessel liefert ihn nicht.
	 *
	 * @param projectSurvives ob das Projekt den Vorgang ueberlebt. Beim
	 *                        Statuswechsel ja, beim Loeschen nein; im zweiten Fall
	 *                        entsteht die Protokollzeile ohne Projektverweis
	 *                        ({@link Top10Placement#withoutProject()})
	 */
	private void releaseSeat(Project project, User actor, boolean projectSurvives) {
		Top10Entry entry = entryRepository.findByProjectId(project.getId()).orElse(null);
		if (entry == null) {
			return;
		}

		Top10Placement released = Top10Placement.of(entry);
		if (!projectSurvives) {
			released = released.withoutProject();
		}

		entryRepository.delete(entry);
		entryRepository.flush();

		auditService.record(actor, List.of(released), List.of());
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
	 *
	 * <p><strong>Ohne {@code proposedPosition}</strong>, und das ist seit
	 * Contract v69 ausdruecklich so festgelegt (§3.11.1 Regel 5). Den Platz
	 * traegt allein der Weg, auf dem die Administration ihn <em>entscheidet</em>,
	 * also {@code POST /admin/top10-nominations/{id}/accept}. Hier wird nicht
	 * ueber einen Vorschlag entschieden, sondern die Liste gesetzt; dass eine
	 * offene Nominierung dabei erledigt ist, ist die Nebenwirkung. Der Platz
	 * steht in diesem Fall im {@link Top10Entry}, und dort ist er ohnehin die
	 * verbindliche Angabe. Entschieden in der Klaerungsrunde zu KAN-37.
	 */
	private void closeOpenNominations(User admin, List<UUID> projectIds, Instant now) {
		if (projectIds.isEmpty()) {
			return;
		}

		List<Top10Nomination> open = nominationRepository.findByStatusAndProjectIdIn(
				NominationStatus.PENDING, projectIds);
		if (open.isEmpty()) {
			return;
		}

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
