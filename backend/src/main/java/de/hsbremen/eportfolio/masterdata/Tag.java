package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

/**
 * Ein Schlagwort als Stammdatenzeile (§3.19).
 *
 * <p><strong>Warum eine Tabelle und kein Freitext:</strong> bis Contract v56
 * trug jede Zuordnung in {@code project_tag} den Text selbst. Damit waren
 * &bdquo;Nachhaltigkeit&ldquo; und &bdquo;nachhaltigkeit&ldquo; zwei
 * verschiedene Tags, und eine Vorschlagsliste haette dieselbe Sache mehrfach
 * angeboten. Dieselbe Bewegung wie beim Semester in §3.18, nur ohne
 * Freigabeschritt: Autor:innen duerfen neue Tags anlegen, das Feld ist eine
 * Combobox und kein Auswahlfeld mit fester Liste.
 *
 * <p><strong>Eindeutig ist {@code lower(name)}, nicht {@code name}.</strong> Die
 * Regel steht als Ausdrucksindex {@code uq_tag_name_lower} in der Datenbank und
 * deshalb <em>nicht</em> als {@code unique = true} an dieser Spalte: die
 * Annotation beschriebe einen Constraint, den es so nicht gibt, und ein
 * gewoehnliches {@code unique (name)} liesse genau die Dubletten zu, wegen derer
 * es diese Tabelle gibt.
 *
 * <p><strong>{@code name} ist bereits normalisiert.</strong> Was hier steht, ist
 * getrimmt und hat keine inneren Mehrfach-Leerzeichen; darum kuemmert sich der
 * einzige Schreibweg, {@code ProjectWriteService.applyTags}. Die Entity prueft
 * das nicht nach: sie wuerde damit eine Zusage doppeln, die schon an zwei
 * Stellen steht, in der Migration und im Schreibweg.
 *
 * <p>Bewusst ohne {@code active} und ohne {@code sortOrder}. Die Reihenfolge der
 * Vorschlaege ist die Verwendungshaeufigkeit und wird gezaehlt statt gepflegt
 * (§6.1, {@code GET /api/tags}); ein Auswahlzustand haette keinen Ort, an dem
 * ihn jemand setzen koennte, solange es die Tag-Verwaltung auf der
 * Administrationsseite noch nicht gibt.
 *
 * <p>Wie die uebrigen Stammdaten ohne Zeitstempel: {@link BaseEntity} bringt nur
 * die {@code id}.
 */
@Entity
public class Tag extends BaseEntity {

	@Column(nullable = false, length = 64)
	private String name;

	protected Tag() {
		// Von JPA benoetigt.
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}
}
