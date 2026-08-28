package de.hsbremen.eportfolio.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Frist der Bearbeitungssperre aus API-Contract §6.9 ({@code app.edit-lock}).
 *
 * <p>Die Sperre haelt sich nicht von selbst: sie gilt nur so lange, wie die
 * haltende Sitzung ihren Herzschlag schickt. Bleibt er aus, weil der Tab
 * geschlossen wurde, der Rechner eingeschlafen ist oder das Netz gewechselt
 * hat, faellt der Beitrag nach {@code ttl} von selbst wieder frei. Ohne diese
 * Frist bliebe ein Beitrag nach jedem abgebrochenen Editor dauerhaft
 * gesperrt, und niemand koennte die Sperre aufloesen: §6.9 laesst das Brechen
 * einer fremden Sperre ausdruecklich nicht zu.
 *
 * <p><strong>Warum die Defaults im Record stehen</strong> und nicht allein in
 * der YAML, anders als bei {@link PermissionProperties}: der Wert ist keine
 * offene fachliche Frage, sondern eine Betriebsgroesse. Faellt der
 * YAML-Eintrag weg, soll die Anwendung mit einer brauchbaren Frist starten und
 * nicht mit {@code null}. Vorbild ist {@link LoginAttemptProperties}.
 *
 * <p><strong>Zum Verhaeltnis von Frist und Herzschlag:</strong> der Takt des
 * Clients liegt bewusst deutlich unter der Frist (10 Sekunden gegen 30), damit
 * ein einzelner verlorener Herzschlag die Sperre noch nicht abgibt. Der Takt
 * selbst steht nicht hier: er ist eine Eigenschaft des Clients und wuerde als
 * Serverproperty nur so tun, als koenne der Server ihn durchsetzen.
 *
 * @param ttl Frist ohne Herzschlag, nach der eine Sperre verfaellt. Default
 *            30 Sekunden
 */
@ConfigurationProperties(prefix = "app.edit-lock")
public record EditLockProperties(
		Duration ttl) {

	public EditLockProperties {
		if (ttl == null || ttl.isZero() || ttl.isNegative()) {
			ttl = Duration.ofSeconds(30);
		}
	}
}
