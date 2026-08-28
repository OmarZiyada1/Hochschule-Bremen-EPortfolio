package de.hsbremen.eportfolio.editlock;

import de.hsbremen.eportfolio.config.EditLockProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Haelt die Bearbeitungssperren im Arbeitsspeicher: je Projekt hoechstens eine
 * (§6.9).
 *
 * <p><strong>Warum keine Tabelle.</strong> Eine Sperre lebt Sekunden und ist
 * nach einem Neustart gegenstandslos: niemand sitzt nach dem Hochfahren noch in
 * demselben Editor. Sie zu persistieren hiesse, einen Zustand dauerhaft zu
 * fuehren, der seine Bedeutung mit dem Prozess verliert, und dafuer eine
 * Migration, eine Entity und ein Aufraeumen in der Datenbank zu unterhalten.
 * Vorbild und Bauform ist der Anmeldezaehler aus §6.5
 * ({@code auth.AttemptCounter}): {@code ConcurrentHashMap} plus {@link Clock}
 * plus gelegentliches Aufraeumen.
 *
 * <p><strong>Der Preis steht im Contract</strong> (§6.9) und wird bewusst
 * getragen: die Sperre gilt je Instanz, nicht im Verbund, und nach einem
 * Neustart ist sie leer. Dann sind kurzzeitig zwei Sitzungen schreibberechtigt.
 * Aufgefangen wird das vom Optimistic Locking aus §6.4, das darunter bestehen
 * bleibt; die Sperre ersetzt es nicht, sie macht den Konflikt nur selten.
 *
 * <p><strong>Jede Zustandsaenderung laeuft ueber {@code compute}.</strong> Das
 * ist nicht Geschmack, sondern die ganze Zusage dieser Klasse: Lesen, Pruefen
 * und Schreiben muessen je Projekt ein Schritt sein. Zwei Sitzungen, die im
 * selben Augenblick den Editor oeffnen, wuerden bei einem {@code get} gefolgt
 * von einem {@code put} beide „frei" sehen und beide schreiben; genau der Fall,
 * den die Sperre verhindern soll, entstuende in ihr selbst.
 *
 * <p><strong>Abgelaufene Eintraege verschwinden beim Lesen</strong>, und
 * zusaetzlich raeumt {@link #cleanUpOccasionally()} gelegentlich die ganze
 * Karte durch. Ohne das zweite bliebe je Projekt, das einmal bearbeitet und nie
 * wieder angefasst wurde, ein toter Eintrag stehen. Eine geplante Aufgabe
 * waere der andere Weg; sie waere hier die zweite {@code @Scheduled}-Methode
 * im Projekt und zoege nach dem Javadoc von {@code config.SchedulingConfig}
 * einen eigenen Thread-Pool nach sich, fuer eine Aufgabe, die einen einzelnen
 * Kartendurchlauf kostet.
 */
@Component
public class EditLockRegistry {

	/**
	 * Nach so vielen Zugriffen wird einmal die ganze Karte durchgesehen. Der
	 * Wert ist bewusst grob: das Aufraeumen ist reine Speicherhygiene, kein
	 * Teil der Fachlichkeit. Der Ablauf einer einzelnen Sperre haengt nicht
	 * daran, er wird bei jedem Lesen geprueft.
	 */
	private static final int CLEAN_UP_EVERY = 200;

	private final Map<UUID, EditLock> locks = new ConcurrentHashMap<>();

	private final AtomicInteger callsSinceCleanUp = new AtomicInteger();

	private final EditLockProperties properties;

	private final Clock clock;

	/**
	 * {@code @Autowired} ist noetig, weil es zwei Konstruktoren gibt und Spring
	 * sonst nicht weiss, welchen es nehmen soll. Dieselbe Bauform wie bei
	 * {@code auth.LoginAttemptService}.
	 */
	@Autowired
	public EditLockRegistry(EditLockProperties properties) {
		this(properties, Clock.systemUTC());
	}

	/** Fuer Tests, die die Uhr vorstellen muessen. */
	EditLockRegistry(EditLockProperties properties, Clock clock) {
		this.properties = properties;
		this.clock = clock;
	}

	/**
	 * Bewirbt sich um die Sperre und setzt zugleich den Herzschlag.
	 *
	 * <p>Drei Faelle in einem Schritt: ist das Projekt frei oder die bestehende
	 * Sperre abgelaufen, uebernimmt die aufrufende Person; haelt sie bereits,
	 * behaelt sie ihre {@code since} und erneuert allein die Frist; haelt
	 * jemand anders, bleibt dessen Sperre unberuehrt.
	 *
	 * <p><strong>Idempotent und ohne Ablehnung.</strong> Die Methode gibt immer
	 * den Stand nach dem Aufruf zurueck, nie einen Fehler. Ob die aufrufende
	 * Person schreiben darf, liest der Aufrufer daran ab, ob
	 * {@link EditLock#userId()} die eigene ist.
	 *
	 * @param projectId betroffenes Projekt
	 * @param userId    aufrufendes Konto
	 * @param firstName Vorname, fuer die Anzeige beim naechsten fremden Aufruf
	 * @param lastName  Nachname, ebenso
	 * @return wer nach diesem Aufruf haelt, nie {@code null}
	 */
	public EditLock acquireOrRenew(UUID projectId, UUID userId, String firstName,
			String lastName) {

		cleanUpOccasionally();
		Instant now = Instant.now(clock);

		return locks.compute(projectId, (key, current) -> {
			if (current == null || expired(current, now)) {
				return new EditLock(userId, firstName, lastName, now, now);
			}
			if (current.userId().equals(userId)) {
				// Der Beginn bleibt stehen, sonst zeigte die Anzeige der
				// anderen Sitzung bei jedem Herzschlag "seit gerade eben".
				return new EditLock(current.userId(), firstName, lastName,
						current.since(), now);
			}
			return current;
		});
	}

	/**
	 * Wer haelt gerade, falls jemand haelt.
	 *
	 * <p>Ein abgelaufener Eintrag wird dabei entfernt und nicht nur
	 * uebergangen: sonst bliebe er bis zum naechsten Aufraeumen stehen und
	 * jeder Leser muesste die Frist erneut selbst pruefen.
	 *
	 * @param projectId betroffenes Projekt
	 * @return die geltende Sperre, sonst leer
	 */
	public Optional<EditLock> holder(UUID projectId) {
		cleanUpOccasionally();
		Instant now = Instant.now(clock);
		return Optional.ofNullable(locks.computeIfPresent(projectId,
				(key, current) -> expired(current, now) ? null : current));
	}

	/**
	 * Gibt die <strong>eigene</strong> Sperre frei; eine fremde bleibt stehen.
	 *
	 * <p>Das ist die Festlegung aus §6.9 und keine Luecke: waere das Brechen
	 * moeglich, waere die Sperre keine. Wer zu Unrecht ausgesperrt ist, wartet
	 * die Frist ab; sie ist dafuer kurz genug.
	 *
	 * <p>Idempotent: ein zweiter Aufruf und ein Aufruf ohne gehaltene Sperre
	 * tun nichts und melden das auch nicht als Fehler. Der Client ruft beim
	 * Verlassen der Seite, und dort ist nicht zu wissen, ob die Sperre
	 * inzwischen abgelaufen oder uebergegangen ist.
	 *
	 * @param projectId betroffenes Projekt
	 * @param userId    aufrufendes Konto
	 */
	public void release(UUID projectId, UUID userId) {
		locks.computeIfPresent(projectId,
				(key, current) -> current.userId().equals(userId) ? null : current);
	}

	/** Nur fuer Tests: wie viele Eintraege die Karte fuehrt. */
	int size() {
		return locks.size();
	}

	/** Nur fuer Tests: alles vergessen. */
	void clear() {
		locks.clear();
		callsSinceCleanUp.set(0);
	}

	/**
	 * Haelt die Karte klein. Ohne das wuechse sie mit jedem Projekt, das einmal
	 * bearbeitet und danach nie wieder geoeffnet wurde.
	 */
	private void cleanUpOccasionally() {
		if (callsSinceCleanUp.incrementAndGet() < CLEAN_UP_EVERY) {
			return;
		}
		callsSinceCleanUp.set(0);
		Instant now = Instant.now(clock);
		/*
		 * removeIf auf der Wertesicht einer ConcurrentHashMap entfernt seit
		 * JDK 9 nur bei unveraendertem Wert. Weil EditLock ein Record mit
		 * Wertgleichheit ist, kann dieser Durchlauf keine Sperre wegraeumen,
		 * die waehrenddessen frisch erworben wurde.
		 */
		locks.values().removeIf(lock -> expired(lock, now));
	}

	private boolean expired(EditLock lock, Instant now) {
		return !lock.lastSeen().plus(properties.ttl()).isAfter(now);
	}
}
