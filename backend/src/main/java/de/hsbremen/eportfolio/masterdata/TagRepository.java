package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Datenbankzugriff auf Schlagwoerter (§3.19).
 *
 * <p>Anders als die uebrigen Stammdaten kennt dieses Repository keine Methode,
 * die alle Zeilen liefert. Die Zahl der Tags waechst mit jedem Projekt, und
 * gebraucht werden immer nur die vordersten: die Vorschlagsliste aus
 * {@code GET /api/tags} ist nach Verwendungshaeufigkeit begrenzt, der
 * Schreibweg sucht genau einen Namen.
 */
public interface TagRepository extends JpaRepository<Tag, UUID> {

	/**
	 * Sucht ein Tag ohne Ruecksicht auf Gross- und Kleinschreibung, fuer den
	 * Schreibweg in {@code ProjectWriteService.applyTags}.
	 *
	 * <p>Ausgeschriebenes {@code lower(...)} statt des abgeleiteten
	 * {@code IgnoreCase}: Spring Data setzt dafuer {@code upper(...)} ein, der
	 * Unique-Index der Tabelle steht dagegen auf {@code lower(name)}. Beides
	 * faellt fuer ASCII zusammen, aber die Suche soll genau das fragen, was der
	 * Index entscheidet, sonst weichen Fund und Konflikt in einem Randfall
	 * voneinander ab.
	 *
	 * @param name bereits normalisierter Name (getrimmt, ohne innere
	 *             Mehrfach-Leerzeichen); die Schreibweise ist gleichgueltig
	 */
	@Query("select t from Tag t where lower(t.name) = lower(:name)")
	Optional<Tag> findByNameNormalized(@Param("name") String name);

	/**
	 * Legt das Tag an, falls es der Unique-Index noch nicht kennt.
	 *
	 * <p><strong>Warum nativ und mit {@code on conflict}:</strong> zwei
	 * gleichzeitige Projekt-Speicherungen mit demselben neuen Tag verletzen
	 * sonst {@code uq_tag_name_lower}, und PostgreSQL bricht die laufende
	 * Transaktion bei einem Constraint-Verstoss ab. Den Fehler nachtraeglich
	 * abzufangen hilft deshalb nicht: die anschliessende Suche liefe in einer
	 * toten Transaktion, und aus einem gelungenen Speichervorgang wuerde 500
	 * {@code INTERNAL_ERROR}. Mit {@code on conflict do nothing} entsteht der
	 * Fehler gar nicht erst, beide Speicherungen gelingen und bekommen dieselbe
	 * Zeile. Dieselbe Ueberlegung wie bei
	 * {@code ReactionRepository.insertIfAbsent}, der zweiten und einzigen
	 * weiteren nativen Abfrage im Backend.
	 *
	 * <p>Das Konfliktziel ist der Ausdruck {@code lower(name)} und nicht die
	 * Spalte: genau darauf steht der Index aus der Migration.
	 *
	 * <p>Die {@code id} vergibt {@code gen_random_uuid()}, seit PostgreSQL 13 im
	 * Kern enthalten und gleichwertig zu {@code GenerationType.UUID} aus der
	 * {@link de.hsbremen.eportfolio.common.domain.BaseEntity}. Ob die Zeile neu
	 * ist oder schon stand, sagt diese Anweisung bewusst nicht: der Aufrufer
	 * liest danach ohnehin ueber {@link #findByNameNormalized}, weil er die
	 * verwaltete Entity braucht.
	 *
	 * @param name normalisierter Anzeigename in der getippten Schreibweise
	 */
	@Modifying
	@Query(value = "insert into tag (id, name) values (gen_random_uuid(), :name) "
			+ "on conflict (lower(name)) do nothing", nativeQuery = true)
	void insertIfAbsent(@Param("name") String name);

	/**
	 * Die Vorschlagsliste aus {@code GET /api/tags}: Name und Verwendungszahl in
	 * einer Abfrage.
	 *
	 * <p><strong>Ein {@code right join} und kein zweiter Durchgang je Zeile.</strong>
	 * Die Zaehlung haengt an der Zuordnungstabelle, die Sortierung haengt an der
	 * Zaehlung; wer erst die Tags holte und dann je Tag zaehlte, baute genau das
	 * N+1, das {@code BlockTypeCount} und {@code ProjectStatusCount} vermeiden.
	 * Die Richtung ist {@code Project} nach {@code tags}, weil das Modell nur
	 * diesen Weg kennt: {@link Tag} traegt bewusst keine Rueckseite auf
	 * {@code Project}, das machte aus der Stammdatenzeile einen Einstieg in den
	 * gesamten Projektbestand und verkehrte die Paketrichtung. Der aeussere Join
	 * haelt die Tags im Ergebnis, die gerade kein Projekt tragen; sie kommen mit
	 * {@code count} null ans Ende.
	 *
	 * <p><strong>Gezaehlt wird ueber alle Projektstatus.</strong> Die Zahl
	 * beantwortet &bdquo;wie gebraeuchlich ist dieses Wort&ldquo; und nicht
	 * &bdquo;wie oft ist es oeffentlich sichtbar&ldquo;. Sie verraet nicht,
	 * welches Projekt welches Wort traegt, weshalb der Endpoint wie die uebrigen
	 * Stammdaten ohne Token lesbar ist (§5).
	 *
	 * <p>Genau gelesen heisst das: <strong>das Wort selbst wird mit dem ersten
	 * Entwurf oeffentlich</strong>, auch wenn das Projekt es nie wird. Das ist
	 * kein Versehen, sondern die Zusage aus §3.19: schutzwuerdig ist der
	 * Projektbezug und nicht das Vokabular. Wer das anders haben will, muss die
	 * Zaehlung auf PUBLISHED einschraenken, und das waere eine Contract-Frage.
	 *
	 * <p>Das Muster kommt fertig aus dem Service, einschliesslich der
	 * Prozentzeichen und der entwerteten Platzhalter. Ohne Suchbegriff ist es
	 * schlicht {@code %}: ein Sonderzweig fuer &bdquo;kein Filter&ldquo; wuerde
	 * dieselbe Abfrage ein zweites Mal aufschreiben, und ein
	 * {@code :pattern is null}-Zweig zwaenge Hibernate, den Typ eines
	 * ungebundenen Parameters zu raten.
	 *
	 * <p><strong>Maskierzeichen ist {@code !} und nicht der Backslash</strong>,
	 * anders als im {@code ProjectSpecifications}. Der Grund ist HQL und nicht
	 * die Fachlichkeit: in einem HQL-Zeichenkettenliteral maskiert der
	 * Backslash das Anfuehrungszeichen, aber er wird nicht wieder aufgeloest.
	 * {@code escape '\'} liest Hibernate deshalb als leeres Literal und
	 * {@code escape '\\'} als zwei Zeichen; beides bricht die Abfrage schon
	 * beim Hochfahren. Der {@code ProjectSpecifications} hat das Problem nicht,
	 * weil die Criteria-API das Zeichen als {@code char} entgegennimmt und nie
	 * durch einen Parser schickt.
	 *
	 * @param pattern kleingeschriebenes {@code like}-Muster mit dem Maskierzeichen
	 *                aus {@code MasterDataService}
	 * @param page    Obergrenze der Trefferzahl, immer die erste Seite und ohne
	 *                eigene Sortierung; die Ordnung steht in der Abfrage
	 */
	@Query("select new de.hsbremen.eportfolio.masterdata.TagUsageCount(t.id, t.name, count(p.id)) "
			+ "from Project p right join p.tags t "
			+ "where lower(t.name) like :pattern escape '!' "
			+ "group by t.id, t.name "
			+ "order by count(p.id) desc, t.name asc")
	List<TagUsageCount> findUsage(@Param("pattern") String pattern, Pageable page);
}
