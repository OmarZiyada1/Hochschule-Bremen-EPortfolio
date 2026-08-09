package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import de.hsbremen.eportfolio.common.enums.Top10Action;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Eine Zeile des unveraenderlichen Aenderungsprotokolls der Top-10-Kuratierung
 * (§3.17).
 *
 * <p><strong>Warum die Top-10 ein Protokoll bekommt und andere
 * Verwaltungsvorgaenge nicht:</strong> sie ist die einzige rein kuratorische
 * Entscheidung des Portals. Eine Platzierung ist eine Auszeichnung, die eine
 * einzelne Rolle ohne Vier-Augen-Prinzip vergibt. Statuswechsel an Projekten
 * sind ueber {@code ProjectStatusHistory} (§3.12) schon nachvollziehbar,
 * Stammdatenaenderungen haben keine vergleichbare Aussenwirkung.
 *
 * <p><strong>Es gibt keinen Weg, eine Zeile zu aendern oder zu loeschen.</strong>
 * Geschrieben wird ausschliesslich in {@code Top10AuditService.record}, und
 * {@link Top10AuditEntryRepository} fuehrt keine Loesch- oder Aendermethode. Ein
 * aenderbares Protokoll beantwortet die Frage nicht mehr, fuer die es angelegt
 * wurde. Die Setter unten sind deshalb paketprivat: sie fuellen die Zeile beim
 * Anlegen und stehen ausserhalb von {@code top10} niemandem zur Verfuegung.
 *
 * <p>Der Tabellenname wird wie bei {@link Top10Entry} explizit gesetzt, weil die
 * Naming-Strategy aus „Top10AuditEntry" sonst „top10auditentry" ableiten wuerde:
 * sie trennt nur zwischen Klein- und Grossbuchstabe, nicht nach Ziffern.
 */
@Entity
@Table(name = "top10_audit_entry")
public class Top10AuditEntry extends BaseEntity {

	/**
	 * Spaltenname bewusst {@code timestamp}, wie bei
	 * {@code ProjectStatusHistory}: das Wort ist in Postgres ein
	 * col_name_keyword und als Spaltenname ohne Anfuehrungszeichen zulaessig.
	 */
	@Column(nullable = false)
	private Instant timestamp;

	/**
	 * Wer die Aenderung veranlasst hat, nicht „welcher Admin" (§3.17, Nachtrag
	 * v28). Beim Entzug des Platzes durch einen Statuswechsel ist das die
	 * Redaktion, das Feld haelt dann eine Person mit der Rolle EDITOR. An der
	 * Rechtematrix aendert das nichts: kuratieren und das Protokoll lesen darf
	 * weiterhin allein ADMIN (§5).
	 */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "admin_id", nullable = false)
	private User admin;

	/**
	 * Das betroffene Projekt, <em>nullable</em>.
	 *
	 * <p>Zwei Gruende, und beide stehen in §3.17. Erstens loescht
	 * {@code DELETE /projects/{id}} wirklich (§6.1); der Fremdschluessel steht
	 * deshalb auf {@code on delete set null}, damit die Protokollzeile das
	 * Loeschen ueberlebt und nur ihren Verweis verliert. Zweitens ist die Spalte
	 * schon im Contract als nullable gefuehrt, weil eine Umsortierung mehrere
	 * Projekte betrifft; diese Umsetzung schreibt dafuer allerdings einen Eintrag
	 * je bewegtem Projekt und keinen Sammeleintrag, weshalb hier im Regelfall ein
	 * Projekt steht.
	 */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "project_id")
	private Project project;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private Top10Action action;

	/** Wrapper-Typ, weil die Spalte nullable ist: {@code ADDED} hat keinen. */
	private Integer previousPosition;

	/** Wrapper-Typ, weil die Spalte nullable ist: {@code REMOVED} hat keinen. */
	private Integer newPosition;

	protected Top10AuditEntry() {
		// Von JPA benoetigt.
	}

	public Instant getTimestamp() {
		return timestamp;
	}

	void setTimestamp(Instant timestamp) {
		this.timestamp = timestamp;
	}

	public User getAdmin() {
		return admin;
	}

	void setAdmin(User admin) {
		this.admin = admin;
	}

	public Project getProject() {
		return project;
	}

	void setProject(Project project) {
		this.project = project;
	}

	public Top10Action getAction() {
		return action;
	}

	void setAction(Top10Action action) {
		this.action = action;
	}

	public Integer getPreviousPosition() {
		return previousPosition;
	}

	void setPreviousPosition(Integer previousPosition) {
		this.previousPosition = previousPosition;
	}

	public Integer getNewPosition() {
		return newPosition;
	}

	void setNewPosition(Integer newPosition) {
		this.newPosition = newPosition;
	}
}
