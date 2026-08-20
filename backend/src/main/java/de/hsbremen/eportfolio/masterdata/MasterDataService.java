package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.masterdata.dto.CategoryResponse;
import de.hsbremen.eportfolio.masterdata.dto.FacultyResponse;
import de.hsbremen.eportfolio.masterdata.dto.ModuleResponse;
import de.hsbremen.eportfolio.masterdata.dto.SemesterResponse;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramResponse;
import de.hsbremen.eportfolio.masterdata.dto.TagResponse;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lesezugriff auf die Referenzlisten aus §3.6 bis §3.9, §3.18 und §3.19.
 *
 * <p>Alle Listen gehen sortiert und ohne Paginierung heraus (§6.1). Das ist kein
 * vergessenes Seitenmodell: es sind kleine, selten veraenderliche Listen, die
 * das Frontend vollstaendig braucht, als Dropdown bei Projektanlage und
 * Registrierung und als Filterleiste der Projektliste. Eine Seitenaufteilung
 * wuerde dort nur einen zweiten Ladeweg erzeugen.
 *
 * <p><strong>Ausnahme sind die Schlagwoerter</strong> (§3.19): sie werden nicht
 * gepflegt, sondern wachsen mit jedem Projekt, und gehen deshalb begrenzt
 * heraus. Die ausfuehrliche Begruendung steht an {@link #tags(String, Integer)}.
 *
 * <p>Sortiert wird nach {@code name}, beim Semester dagegen nach der gepflegten
 * Reihenfolge {@code sortOrder} (§3.18): alphabetisch stuende dort
 * &bdquo;SoSe 2026&ldquo; vor &bdquo;WiSe 2025/26&ldquo;.
 *
 * <p><strong>Keine Berechtigungspruefung:</strong> die Endpoints sind PUBLIC
 * (§5). Stammdaten haengen an keiner Ressource mit Eigentuemer, es gibt also
 * nichts, was der {@code ProjectPermissionService} hier entscheiden koennte.
 * Sie enthalten auch nichts Schuetzenswertes: Fakultaets- und Modulnamen der
 * Hochschule stehen ohnehin oeffentlich im Netz.
 */
@Service
// Klassenweit, weil jede Methode dieser Klasse ausschliesslich liest. readOnly
// erspart Hibernate den Dirty-Check und macht die Absicht sichtbar.
@Transactional(readOnly = true)
public class MasterDataService {

	private final CategoryRepository categoryRepository;

	private final FacultyRepository facultyRepository;

	private final StudyProgramRepository studyProgramRepository;

	private final ModuleRepository moduleRepository;

	private final SemesterRepository semesterRepository;

	private final TagRepository tagRepository;

	public MasterDataService(CategoryRepository categoryRepository, FacultyRepository facultyRepository,
			StudyProgramRepository studyProgramRepository, ModuleRepository moduleRepository,
			SemesterRepository semesterRepository, TagRepository tagRepository) {
		this.categoryRepository = categoryRepository;
		this.facultyRepository = facultyRepository;
		this.studyProgramRepository = studyProgramRepository;
		this.moduleRepository = moduleRepository;
		this.semesterRepository = semesterRepository;
		this.tagRepository = tagRepository;
	}

	/** Alle Kategorien fuer {@code GET /api/categories}. */
	public List<CategoryResponse> categories() {
		return categoryRepository.findAllByOrderByNameAsc().stream()
				.map(CategoryResponse::from)
				.toList();
	}

	/** Alle Fakultaeten fuer {@code GET /api/faculties}. */
	public List<FacultyResponse> faculties() {
		return facultyRepository.findAllByOrderByNameAsc().stream()
				.map(FacultyResponse::from)
				.toList();
	}

	/**
	 * Studiengaenge fuer {@code GET /api/study-programs}, optional auf eine
	 * Fakultaet eingeschraenkt.
	 *
	 * <p>Eine unbekannte {@code facultyId} ergibt eine leere Liste und kein 404:
	 * der Parameter filtert eine Liste, er adressiert keine Ressource. Ein 404
	 * wuerde ausserdem die Aussage „diese Fakultaet gibt es nicht" treffen, die
	 * dieser Endpoint gar nicht verantwortet.
	 *
	 * @param facultyId Filter; {@code null} liefert alle Studiengaenge
	 */
	public List<StudyProgramResponse> studyPrograms(UUID facultyId) {
		List<StudyProgram> found = facultyId == null
				? studyProgramRepository.findAllByOrderByNameAsc()
				: studyProgramRepository.findByFacultyIdOrderByNameAsc(facultyId);

		return found.stream()
				.map(StudyProgramResponse::from)
				.toList();
	}

	/**
	 * Module fuer {@code GET /api/modules}, optional auf einen Studiengang
	 * eingeschraenkt. Zur unbekannten ID gilt dasselbe wie bei
	 * {@link #studyPrograms(UUID)}.
	 *
	 * @param studyProgramId Filter; {@code null} liefert alle Module
	 */
	public List<ModuleResponse> modules(UUID studyProgramId) {
		List<Module> found = studyProgramId == null
				? moduleRepository.findAllByOrderByNameAsc()
				: moduleRepository.findByStudyProgramIdOrderByNameAsc(studyProgramId);

		return found.stream()
				.map(ModuleResponse::from)
				.toList();
	}

	/**
	 * Semester fuer {@code GET /api/semesters} (§3.18), optional auf den
	 * Auswahlzustand eingeschraenkt.
	 *
	 * <p>Ohne Parameter kommen <strong>alle</strong> Semester, auch die
	 * deaktivierten. Das Metadaten-Formular fragt mit {@code active=true} nach,
	 * weil dort nur Waehlbares stehen darf; die Filtergruppe der
	 * Projektbibliothek dagegen braucht auch die abgelaufenen, sonst
	 * verschwaenden veroeffentlichte Projekte aus der Suche, sobald ihr Semester
	 * vorbei ist.
	 *
	 * @param active Filter; {@code null} liefert alle Semester
	 */
	public List<SemesterResponse> semesters(Boolean active) {
		List<Semester> found = active == null
				? semesterRepository.findAllByOrderBySortOrderAsc()
				: semesterRepository.findAllByActiveOrderBySortOrderAsc(active);

		return found.stream()
				.map(SemesterResponse::from)
				.toList();
	}

	// ------------------------------------------------------------------
	// Schlagwoerter (§3.19)
	// ------------------------------------------------------------------

	/**
	 * Vorgabe fuer {@code limit}, wenn der Aufruf keine nennt (§6.1).
	 *
	 * <p>Paketsichtbar und nicht privat, damit der Test die Zahl nicht ein
	 * zweites Mal aufschreibt: eine Vorgabe, die an zwei Stellen steht, laeuft
	 * beim naechsten Contract-Nachtrag auseinander.
	 */
	static final int TAG_LIMIT_DEFAULT = 20;

	/** Obergrenze fuer {@code limit} (§6.1). */
	static final int TAG_LIMIT_MAX = 100;

	/**
	 * Maskierzeichen fuer {@code like} in {@link TagRepository#findUsage}.
	 *
	 * <p>Ein Ausrufezeichen und nicht der Backslash aus dem
	 * {@code ProjectSpecifications}: HQL kann den Backslash in einem
	 * Zeichenkettenliteral nicht als Zeichen ausdruecken, die Begruendung steht
	 * an der Abfrage. Fachlich macht die Wahl keinen Unterschied, solange das
	 * Zeichen sich selbst entwertet, und genau das tut die erste Ersetzung in
	 * {@link #likePattern(String)}.
	 */
	private static final String TAG_ESCAPE = "!";

	/**
	 * Innere Mehrfach-Leerzeichen, siehe {@link #likePattern(String)}. Dasselbe
	 * Muster wie in {@code ProjectWriteService.normalizedTagName}; es steht hier
	 * ein zweites Mal, weil ein gemeinsamer Ort einen der beiden Dienste vom
	 * anderen abhaengig machte und die Normalform an beiden Enden derselben
	 * Zusage aus &sect;3.19 haengt.
	 */
	private static final Pattern INNER_WHITESPACE = Pattern.compile("\\s+");

	/**
	 * Die Vorschlagsliste fuer {@code GET /api/tags} (§3.19), nach
	 * Verwendungshaeufigkeit absteigend und bei Gleichstand nach Name.
	 *
	 * <p><strong>Warum begrenzt und nicht vollstaendig wie die uebrigen
	 * Stammdaten:</strong> die vier anderen Listen sind gepflegt und klein, die
	 * Zahl der Tags waechst dagegen mit jedem Projekt, weil Autor:innen neue
	 * anlegen duerfen. Eine vollstaendige Liste waere in einem Jahr weder fuer
	 * das Auswahlfeld brauchbar noch fuer die Leitung erklaerbar. Gebraucht
	 * werden ohnehin nur die vordersten; wer ein selteneres Wort sucht, tippt,
	 * und dann filtert {@code q}.
	 *
	 * <p><strong>Ein Wert ausserhalb der Grenzen ergibt 400 und wird nicht
	 * stillschweigend gekappt.</strong> Gekappt bekaeme der Aufrufer weniger
	 * Treffer als angefordert, ohne es zu erfahren, und suchte den Fehler bei
	 * sich. Ein neuer Fehlercode entsteht dafuer nicht: Zahlenbereiche laufen
	 * ueber das vorhandene {@code VALIDATION_FAILED} (§6.2).
	 *
	 * @param query  Filter auf den Namen, ohne Ruecksicht auf Gross- und
	 *               Kleinschreibung und an beliebiger Stelle im Wort;
	 *               {@code null} oder leer liefert die haeufigsten Tags
	 * @param limit  Obergrenze der Trefferzahl; {@code null} bedeutet
	 *               {@value #TAG_LIMIT_DEFAULT}
	 * @return hoechstens {@code limit} Tags, das gebraeuchlichste zuerst
	 * @throws ValidationException wenn {@code limit} ausserhalb von 1 bis
	 *                             {@value #TAG_LIMIT_MAX} liegt
	 */
	public List<TagResponse> tags(String query, Integer limit) {
		int effectiveLimit = limit == null ? TAG_LIMIT_DEFAULT : limit;
		if (effectiveLimit < 1 || effectiveLimit > TAG_LIMIT_MAX) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"limit: Erlaubt ist 1 bis " + TAG_LIMIT_MAX + ".");
		}

		return tagRepository.findUsage(likePattern(query), PageRequest.of(0, effectiveLimit)).stream()
				.map(TagResponse::from)
				.toList();
	}

	/**
	 * Baut das {@code like}-Muster fuer {@link #tags(String, Integer)}.
	 *
	 * <p>Ohne Suchbegriff ist es {@code %} und damit wirkungslos; ein zweiter
	 * Abfragezweig fuer diesen Fall waere dieselbe Abfrage ein zweites Mal.
	 * Die Platzhalter der Eingabe werden entwertet, sonst faende eine Suche nach
	 * {@code %} alles und eine nach {@code _} jedes Wort: dieselbe Ueberlegung
	 * wie bei {@code ProjectSpecifications.searchText}.
	 *
	 * <p><strong>Der Suchbegriff durchlaeuft dieselbe Normalform wie ein
	 * eingehendes Schlagwort</strong> (&sect;3.19): getrimmt, innere
	 * Mehrfach-Leerzeichen zusammengezogen. Ohne das Zusammenziehen faende
	 * &bdquo;Green&nbsp;&nbsp;IT&ldquo; das gespeicherte
	 * &bdquo;Green&nbsp;IT&ldquo; nicht, und das Auswahlfeld boete dasselbe Wort
	 * als neu an, obwohl der Schreibweg beides auf dieselbe Zeile abbildet. Der
	 * Suchweg beantwortet damit dieselbe Frage wie der Schreibweg und nicht eine
	 * knapp danebenliegende.
	 */
	private static String likePattern(String query) {
		if (query == null || query.isBlank()) {
			return "%";
		}
		String normalized = INNER_WHITESPACE.matcher(query.trim()).replaceAll(" ");
		String escaped = normalized.toLowerCase(Locale.ROOT)
				.replace(TAG_ESCAPE, TAG_ESCAPE + TAG_ESCAPE)
				.replace("%", TAG_ESCAPE + "%")
				.replace("_", TAG_ESCAPE + "_");
		return "%" + escaped + "%";
	}
}
