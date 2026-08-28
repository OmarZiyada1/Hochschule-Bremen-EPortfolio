package de.hsbremen.eportfolio.common.enums;

/**
 * Bearbeitungsstand einer Support-Anfrage (§2.15, §3.20).
 *
 * <p>Gesetzt wird er ausschliesslich von der Administration ueber
 * {@code PATCH /api/admin/support/{id}}; die absendende Person sieht ihn nicht,
 * denn sie hat auf ihre eigene Anfrage keinen lesenden Zugriff (§5).
 *
 * <p><strong>Die erlaubten Uebergaenge stehen in
 * {@link #mayTransitionTo(SupportRequestStatus)}</strong> und damit an einer
 * Stelle. Sie hier zu fuehren und nicht im Dienst hat denselben Grund wie beim
 * Projekt-Zustandsautomaten: die Regel gehoert zum Wertebereich und nicht zum
 * Ablauf, der sie anwendet.
 */
public enum SupportRequestStatus {

	/** Eingegangen und noch unbearbeitet. Jede neue Anfrage beginnt hier. */
	OPEN,

	/** Die Administration kuemmert sich bereits darum. */
	IN_PROGRESS,

	/** Erledigt, der normale Abschluss einer Anfrage. */
	RESOLVED;

	/**
	 * Ist der Wechsel von diesem Stand auf {@code target} nach §2.15 erlaubt?
	 *
	 * <p>Vier Uebergaenge sind es: {@code OPEN} nach {@code IN_PROGRESS},
	 * {@code OPEN} nach {@code RESOLVED}, {@code IN_PROGRESS} nach
	 * {@code RESOLVED} und {@code RESOLVED} zurueck nach {@code OPEN}.
	 *
	 * <p><strong>Der Sprung von {@code OPEN} direkt nach {@code RESOLVED} steht
	 * bewusst darin:</strong> viele Anfragen sind in einem Zug erledigt, und ein
	 * erzwungener Zwischenschritt waere ein Klick ohne Aussage. Der Rueckweg aus
	 * {@code RESOLVED} fuehrt dagegen nach {@code OPEN} und nicht nach
	 * {@code IN_PROGRESS}: eine wieder geoeffnete Anfrage soll in derselben
	 * Zaehlung erscheinen wie eine neue, sonst verschwaende sie aus dem Blick,
	 * obwohl sie noch etwas will.
	 *
	 * <p><strong>Der Wechsel auf den bereits stehenden Wert ist keiner</strong>
	 * und ergibt deshalb ebenfalls {@code false}. Die Oberflaeche bietet ihn nie
	 * an; ein stilles 200 auf einen Aufruf, der nichts bewirkt, verdeckte einen
	 * Fehler im aufrufenden Client.
	 */
	public boolean mayTransitionTo(SupportRequestStatus target) {
		return switch (this) {
			case OPEN -> target == IN_PROGRESS || target == RESOLVED;
			case IN_PROGRESS -> target == RESOLVED;
			case RESOLVED -> target == OPEN;
		};
	}
}
