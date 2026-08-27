package de.hsbremen.eportfolio.reaction;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Datenbankzugriff auf Reaktionen.
 */
public interface ReactionRepository extends JpaRepository<Reaction, UUID> {

	Optional<Reaction> findByProjectIdAndUserId(UUID projectId, UUID userId);

	long countByProjectId(UUID projectId);

	/**
	 * Hat diese Person an diesem Projekt bereits reagiert? Fuellt
	 * {@code ProjectDetailResponse.hasReacted} (§3.10, seit Contract v84).
	 *
	 * <p>Ein {@code exists} und kein {@code findBy…}: gebraucht wird die
	 * Ja-Nein-Auskunft, und die Zeile selbst traegt nichts bei, was die
	 * Detailantwort zeigt.
	 */
	boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);

	/**
	 * Stellt sicher, dass die Reaktion dieser Person an diesem Projekt existiert,
	 * fuer {@code POST /api/projects/{id}/reaction} (§6.1, „idempotent").
	 *
	 * <p><strong>Warum eine einzelne Anweisung und kein Pruefen-dann-Anlegen.</strong>
	 * Idempotenz laesst sich auf zwei Wegen erreichen: erst
	 * {@code findByProjectIdAndUserId} und nur bei leerem Ergebnis ein
	 * {@code save}, oder wie hier ein Insert, das den vorhandenen Fall selbst
	 * kennt. Der erste Weg hat zwischen Pruefung und Einfuegen eine Luecke, in die
	 * ein zweiter Aufruf derselben Person passt (Doppelklick, wiederholtes
	 * Absenden). Dann greift der Unique-Constraint
	 * {@code reaction_project_id_user_id_key} aus Migration 4, und aus dem
	 * eigentlich erfolgreichen Fall „die Reaktion ist gesetzt" wuerde ein Fehler.
	 * Ihn nachtraeglich abzufangen hilft nicht: PostgreSQL bricht die laufende
	 * Transaktion bei einem Constraint-Verstoss ab, die anschliessende Zaehlung
	 * fuer die Antwort liefe also in einer toten Transaktion. Mit
	 * {@code on conflict do nothing} entsteht der Fehler gar nicht erst, und der
	 * Constraint entscheidet den Wettlauf dort, wo er ohnehin entschieden wird.
	 *
	 * <p><strong>Eine von zwei nativen Abfragen im Backend</strong>, und zwar
	 * begruendet: {@code on conflict} ist SQL von PostgreSQL und hat in JPQL kein
	 * Gegenstueck. Das Projekt ist ohnehin auf PostgreSQL 16 festgelegt (jsonb in
	 * §3.4, Flyway, kein H2 in den Tests), es entsteht hier also keine neue
	 * Bindung. Die zweite steht aus demselben Grund in
	 * {@code TagRepository.insertIfAbsent} (§3.19).
	 *
	 * <p><strong>Folge fuer {@code createdAt}:</strong> der Wert kommt von
	 * {@code now()} und nicht von {@code @CreatedDate}, weil diese Anweisung am
	 * Persistenzkontext vorbeilaeuft. Beides schreibt denselben Zeitpunkt, den
	 * Beginn der Transaktion; die Annotation an {@link Reaction} bleibt fuer jeden
	 * kuenftigen Schreibweg ueber JPA stehen. Die {@code id} vergibt
	 * {@code gen_random_uuid()}, seit PostgreSQL 13 im Kern enthalten und
	 * gleichwertig zu {@code GenerationType.UUID} aus der {@code BaseEntity}.
	 *
	 * @param projectId Projekt, auf das reagiert wird
	 * @param userId    Person, die reagiert
	 */
	@Modifying
	@Query(value = "insert into reaction (id, project_id, user_id, created_at) "
			+ "values (gen_random_uuid(), :projectId, :userId, now()) "
			+ "on conflict (project_id, user_id) do nothing", nativeQuery = true)
	void insertIfAbsent(@Param("projectId") UUID projectId, @Param("userId") UUID userId);

	/**
	 * Entfernt die Reaktion dieser Person an diesem Projekt, fuer
	 * {@code DELETE /api/projects/{id}/reaction} (§6.1).
	 *
	 * <p>Idempotent ohne weiteres Zutun: gibt es die Zeile nicht, sind null Zeilen
	 * betroffen und der Aufruf bleibt folgenlos. Ein Wettlauf wie beim Anlegen ist
	 * hier nicht moeglich, weil zwei gleichzeitige Loeschungen denselben Zustand
	 * herstellen.
	 *
	 * @return Zahl der entfernten Zeilen, null oder eins
	 */
	long deleteByProjectIdAndUserId(UUID projectId, UUID userId);

	/**
	 * Zaehlt die Reaktionen mehrerer Projekte in einer einzigen Abfrage, fuer
	 * die Kachelliste aus §6.1.
	 *
	 * <p>Projekte ohne Reaktion tauchen im Ergebnis nicht auf, weil
	 * {@code group by} nur ueber vorhandene Zeilen laeuft. Der Aufrufer setzt
	 * fuer sie 0 ein; ein {@code left join} vom Projekt aus wuerde dieselbe
	 * Information mit mehr Aufwand liefern.
	 *
	 * @param projectIds die Projekte einer Seite; leere Sammlung ergibt eine
	 *                   leere Liste
	 */
	@Query("select new de.hsbremen.eportfolio.reaction.ReactionCount(r.project.id, count(r)) "
			+ "from Reaction r where r.project.id in :projectIds group by r.project.id")
	List<ReactionCount> countPerProject(@Param("projectIds") Collection<UUID> projectIds);
}
