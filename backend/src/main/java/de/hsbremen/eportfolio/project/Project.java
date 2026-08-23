package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.common.domain.AuditableEntity;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.masterdata.Category;
import de.hsbremen.eportfolio.masterdata.Faculty;
import de.hsbremen.eportfolio.masterdata.Module;
import de.hsbremen.eportfolio.masterdata.Semester;
import de.hsbremen.eportfolio.masterdata.StudyProgram;
import de.hsbremen.eportfolio.masterdata.Tag;
import de.hsbremen.eportfolio.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.hibernate.annotations.BatchSize;

/**
 * Projekt als Aggregatwurzel. Autor:in ist verpflichtend, die fachliche
 * Zuordnung (Fakultaet, Studiengang, Modul, Kategorie) dagegen optional.
 */
@Entity
@Table(name = "project")
public class Project extends AuditableEntity {

	@Column(nullable = false, length = 255)
	private String title;

	@Column(length = 1024)
	private String summary;

	@Column(length = 1024)
	private String coverImageUrl;

	/** Entspricht dem Default der Spalte, da JPA die Spalte immer mitschreibt. */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ProjectStatus status = ProjectStatus.DRAFT;

	@Enumerated(EnumType.STRING)
	@Column(length = 32)
	private ProjectType projectType;

	@Enumerated(EnumType.STRING)
	@Column(length = 32)
	private Degree degree;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "author_id", nullable = false)
	private User author;

	/**
	 * Funktionsbezeichnung der Autor:in im Projekt, z. B. „Konzept" (§3.3 seit
	 * Contract v66). Freiwillig und jederzeit nachtragbar.
	 *
	 * <p><strong>Warum am Projekt und nicht als Mitgliedszeile.</strong> Die
	 * Autor:in ist keine {@code ProjectMember}-Zeile (§3.13.1); §5 haengt
	 * Rechte an genau dieser Unterscheidung. Gefehlt hat allein die
	 * Moeglichkeit, ihre Rolle zu benennen, und die braucht kein zweites
	 * Verstaendnis davon, wer zum Projekt gehoert.
	 */
	@Column(name = "author_role", length = 255)
	private String authorRole;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "faculty_id")
	private Faculty faculty;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "study_program_id")
	private StudyProgram studyProgram;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "module_id")
	private Module module;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "category_id")
	private Category category;

	/**
	 * Das Semester der Entstehung (§3.3, §3.18).
	 *
	 * <p>Seit Contract v45 ein Fremdschluessel und kein Freitext mehr: der Filter
	 * aus §6.1 verglich exakt auf die getippte Schreibweise, womit
	 * &bdquo;WiSe 2025/26&ldquo; und &bdquo;WS 25/26&ldquo; zwei verschiedene
	 * Semester waren. Wie die uebrigen Stammdatenbezuege {@code nullable}: im
	 * {@code DRAFT} darf es fehlen, Pflicht wird es beim Einreichen.
	 */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "semester_id")
	private Semester semester;

	private Instant publishedAt;

	/**
	 * Zaehler fuer Optimistic Locking (API-Contract §3.3 und §6.4). Hibernate
	 * erhoeht ihn bei jedem Update und vergleicht ihn dabei mit dem Stand in der
	 * Datenbank; passt er nicht, endet der Schreibvorgang mit einer
	 * {@code ObjectOptimisticLockingFailureException} und der
	 * {@code GlobalExceptionHandler} macht daraus 409
	 * {@code PROJECT_VERSION_CONFLICT}.
	 *
	 * <p>Notwendig, weil §3.13 mehrere Projektmitglieder am selben Projekt
	 * vorsieht. Ohne die Pruefung gilt Last-Write-Wins: beim Autosave-Takt des
	 * Editors ueberschreibt der spaetere Speichervorgang fremde Arbeit, ohne
	 * dass es jemand bemerkt.
	 *
	 * <p>Bewusst ohne Setter, denn der Wert gehoert Hibernate. Anwendungscode setzt
	 * ihn nie, sondern vergleicht die Version aus dem Request-Body mit
	 * {@link #getVersion()}.
	 */
	@Version
	@Column(nullable = false)
	private Long version;

	/**
	 * Schlagwoerter, hoechstens fuenf (§3.3, §3.19).
	 *
	 * <p><strong>Seit Contract v57 ein Bezug und keine Zeichenkette mehr.</strong>
	 * Bis dahin stand der Text in {@code project_tag.tag}, womit
	 * &bdquo;Nachhaltigkeit&ldquo; und &bdquo;nachhaltigkeit&ldquo; zwei
	 * verschiedene Tags waren. Nach aussen aendert das nichts: Anfragen und
	 * Antworten fuehren {@code tags} weiterhin als Liste von Namen, nur steht
	 * dahinter jetzt je Wort genau eine Zeile.
	 *
	 * <p>{@code project_tag} ist dieselbe Tabelle wie zuvor, jetzt aber eine
	 * Verknuepfungstabelle mit {@code tag_id} statt einer Wertetabelle. Die
	 * Richtung ist einseitig: {@link de.hsbremen.eportfolio.masterdata.Tag}
	 * traegt keine Rueckseite auf {@code Project}, weil eine Stammdatenzeile kein
	 * Einstieg in den Projektbestand sein soll.
	 *
	 * <p>{@code @BatchSize} ist die Antwort auf das N+1-Problem der Kachelliste:
	 * ohne die Angabe laedt Hibernate die Tags jedes Treffers mit einer eigenen
	 * Abfrage nach, bei zwanzig Kacheln also zwanzig Abfragen. Mit ihr holt es
	 * sie fuer bis zu 50 Projekte auf einmal, womit eine Seite immer mit einer
	 * einzigen Zusatzabfrage auskommt. Ein {@code JOIN FETCH} scheidet hier aus,
	 * weil eine Sammlung mitzuladen die Paginierung in den Arbeitsspeicher
	 * verschieben wuerde.
	 */
	@ManyToMany(fetch = FetchType.LAZY)
	@JoinTable(name = "project_tag",
			joinColumns = @JoinColumn(name = "project_id"),
			inverseJoinColumns = @JoinColumn(name = "tag_id"))
	@BatchSize(size = 50)
	private Set<Tag> tags = new HashSet<>();

	@ManyToMany(fetch = FetchType.LAZY)
	@JoinTable(name = "project_editor",
			joinColumns = @JoinColumn(name = "project_id"),
			inverseJoinColumns = @JoinColumn(name = "user_id"))
	private Set<User> editors = new HashSet<>();

	@OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
	private Set<ProjectMember> members = new HashSet<>();

	/** Geordneter Inhalt; die Reihenfolge liegt in Block.orderIndex. */
	@OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("orderIndex ASC")
	private List<Block> blocks = new ArrayList<>();

	protected Project() {
		// Von JPA benoetigt.
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getSummary() {
		return summary;
	}

	public void setSummary(String summary) {
		this.summary = summary;
	}

	public String getCoverImageUrl() {
		return coverImageUrl;
	}

	public void setCoverImageUrl(String coverImageUrl) {
		this.coverImageUrl = coverImageUrl;
	}

	public ProjectStatus getStatus() {
		return status;
	}

	public void setStatus(ProjectStatus status) {
		this.status = status;
	}

	public ProjectType getProjectType() {
		return projectType;
	}

	public void setProjectType(ProjectType projectType) {
		this.projectType = projectType;
	}

	public Degree getDegree() {
		return degree;
	}

	public void setDegree(Degree degree) {
		this.degree = degree;
	}

	public User getAuthor() {
		return author;
	}

	public void setAuthor(User author) {
		this.author = author;
	}

	public String getAuthorRole() {
		return authorRole;
	}

	public void setAuthorRole(String authorRole) {
		this.authorRole = authorRole;
	}

	public Faculty getFaculty() {
		return faculty;
	}

	public void setFaculty(Faculty faculty) {
		this.faculty = faculty;
	}

	public StudyProgram getStudyProgram() {
		return studyProgram;
	}

	public void setStudyProgram(StudyProgram studyProgram) {
		this.studyProgram = studyProgram;
	}

	public Module getModule() {
		return module;
	}

	public void setModule(Module module) {
		this.module = module;
	}

	public Category getCategory() {
		return category;
	}

	public void setCategory(Category category) {
		this.category = category;
	}

	public Semester getSemester() {
		return semester;
	}

	public void setSemester(Semester semester) {
		this.semester = semester;
	}

	public Instant getPublishedAt() {
		return publishedAt;
	}

	public void setPublishedAt(Instant publishedAt) {
		this.publishedAt = publishedAt;
	}

	/** Siehe {@link #version}, absichtlich ohne passenden Setter. */
	public Long getVersion() {
		return version;
	}

	public Set<Tag> getTags() {
		return tags;
	}

	public void setTags(Set<Tag> tags) {
		this.tags = tags;
	}

	public Set<User> getEditors() {
		return editors;
	}

	public void setEditors(Set<User> editors) {
		this.editors = editors;
	}

	public Set<ProjectMember> getMembers() {
		return members;
	}

	public void setMembers(Set<ProjectMember> members) {
		this.members = members;
	}

	public List<Block> getBlocks() {
		return blocks;
	}

	public void setBlocks(List<Block> blocks) {
		this.blocks = blocks;
	}
}
