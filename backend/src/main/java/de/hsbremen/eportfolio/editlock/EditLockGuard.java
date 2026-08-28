package de.hsbremen.eportfolio.editlock;

import de.hsbremen.eportfolio.common.error.ConflictException;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Setzt die Bearbeitungssperre an den schreibenden Endpoints durch (§6.9).
 *
 * <p><strong>Eine Sperre, die allein die Oberflaeche zumacht, ist keine.</strong>
 * Der Hinweis im Frontend ist die freundliche Auskunft; verlassen kann man sich
 * nur auf diese Pruefung. Ein alter Browserstand, ein aus dem Ruhezustand
 * zurueckgekehrter Rechner oder ein Aufruf ausserhalb der Anwendung schrieben
 * sonst weiter, und die Sperre waere eine Zusage, die der Server nicht haelt.
 *
 * <p><strong>Zwei Tabs derselben Person faengt sie dagegen nicht.</strong>
 * Verglichen wird die Konto-ID und nicht die Sitzung: wer denselben Beitrag
 * zweimal offen hat, haelt in beiden Fenstern dieselbe Sperre. Dafuer ist sie
 * nicht gedacht; diesen Fall deckt das Optimistic Locking aus §6.4 ab, das
 * darunter bestehen bleibt.
 *
 * <p><strong>Warum eine eigene Klasse und kein Aufruf der Registry im
 * Schreibdienst.</strong> Die Frage „darf hier gerade geschrieben werden" hat
 * genau eine Antwort und genau einen Wortlaut. Stuende der Wurf an beiden
 * Schreibpfaden ausgeschrieben, gaebe es zwei Fassungen derselben Regel, und die
 * zweite wuerde beim naechsten Schreibweg vergessen. Dieselbe Ueberlegung wie
 * bei {@code ProjectPermissionService} fuer die Rechte.
 *
 * <p><strong>Diese Klasse kennt weder {@code Project} noch das Paket
 * {@code project}.</strong> Sie nimmt zwei IDs und gibt eine Antwort. Damit
 * bleibt der Weg einseitig: {@code project} ruft {@code editlock}, nie
 * umgekehrt. Waere es anders, haetten die beiden Pakete einen Kreis, und die
 * Sperre koennte irgendwann Rechte oder Status mitentscheiden, was ihr nicht
 * zusteht.
 */
@Component
public class EditLockGuard {

	private final EditLockRegistry registry;

	public EditLockGuard(EditLockRegistry registry) {
		this.registry = registry;
	}

	/**
	 * Wirft, wenn jemand anders das Projekt gerade haelt.
	 *
	 * <p><strong>Aufzurufen nach der Rechte- und Statuspruefung und vor der
	 * Versionspruefung.</strong> Nach den Rechten, weil eine unbeteiligte Person
	 * nicht erfahren soll, wer an einem fremden Entwurf arbeitet: sie bekommt
	 * 403, wie ohne Sperre auch. Vor der Version, weil beide mit 409 antworten
	 * und die Sperre der speziellere Grund ist. Wer gesperrt ist, hat kein
	 * Versionsproblem, sondern gar keinen Schreibzugang; ein
	 * {@code PROJECT_VERSION_CONFLICT} schickte ihn ins Nachladen und danach
	 * erneut gegen dieselbe Wand.
	 *
	 * <p>Haelt niemand oder haelt die aufrufende Person selbst, tut die Methode
	 * nichts. Der Fall „niemand haelt" ist ausdruecklich erlaubt: die Sperre
	 * entsteht erst mit dem Oeffnen des Editors, und ein Schreibzugriff ohne
	 * vorherigen Herzschlag ist kein Fehler, sondern der normale Weg jedes
	 * Clients, der die Sperre nicht kennt.
	 *
	 * @param projectId betroffenes Projekt
	 * @param userId    aufrufendes Konto
	 * @throws ConflictException 409 {@code PROJECT_LOCKED_BY_OTHER}, mit dem
	 *                           Namen der haltenden Person in der Meldung
	 */
	public void requireNotLockedByOther(UUID projectId, UUID userId) {
		registry.holder(projectId)
				.filter(lock -> !lock.userId().equals(userId))
				.ifPresent(lock -> {
					throw ConflictException.lockedByOther(displayName(lock));
				});
	}

	/**
	 * Vor- und Nachname als ein Wort fuer die Meldung.
	 *
	 * <p>Beide Felder sind an {@code User} Pflicht (§3.1), fehlen kann also
	 * keines. Der Fallback steht trotzdem: eine Fehlermeldung ist der falsche
	 * Ort, um an einem {@code null} zu scheitern.
	 */
	private String displayName(EditLock lock) {
		String name = ((lock.firstName() == null ? "" : lock.firstName()) + " "
				+ (lock.lastName() == null ? "" : lock.lastName())).trim();
		return name.isEmpty() ? "Eine andere Person" : name;
	}
}
