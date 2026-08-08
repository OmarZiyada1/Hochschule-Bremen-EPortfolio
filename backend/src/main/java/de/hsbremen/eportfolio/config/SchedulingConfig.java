package de.hsbremen.eportfolio.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Schaltet {@code @Scheduled} ein (KAN-26).
 *
 * <p>Eine eigene Klasse und nicht eine weitere Annotation an
 * {@link AsyncConfig}: dort geht es um den Executor des Mailversands, also um
 * Aufgaben, die ein Request anstoesst. Hier geht es um wiederkehrende Aufgaben
 * ohne Request, derzeit ausschliesslich das Aufraeumen verbrauchter
 * Verifizierungscodes (API-Contract §3.16). Die beiden zusammenzulegen hiesse,
 * einen Schalter unter einem Namen zu fuehren, der ihn nicht beschreibt.
 *
 * <p>Bewusst ohne eigenen Scheduler-Pool: Springs Vorgabe ist ein einzelner
 * Thread, und mehr braucht eine Aufgabe alle sechs Stunden nicht. Kommt eine
 * zweite, laenger laufende Aufgabe dazu, gehoert hier ein
 * {@code ThreadPoolTaskScheduler} hin, sonst warten beide aufeinander.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
