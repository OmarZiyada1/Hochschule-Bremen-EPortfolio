package de.hsbremen.eportfolio.editlock;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.config.EditLockProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests der Bearbeitungssperre im Arbeitsspeicher (§6.9).
 *
 * <p>Der Ablauf einer Sperre ist hier zu Hause und nicht im Integrationstest:
 * er haengt allein an der Uhr, und die laesst sich ohne Spring-Kontext und ohne
 * dreissig Sekunden Wartezeit vorstellen. Vorbild ist
 * {@code auth.LoginAttemptServiceTest}, der denselben fluechtigen Zustand mit
 * Frist prueft.
 */
class EditLockRegistryTest {

	private static final Duration TTL = Duration.ofSeconds(30);

	/** Verstellbare Uhr, damit der Ablauf ohne Warten pruefbar ist. */
	private static class TestClock extends Clock {

		private Instant now = Instant.parse("2026-08-27T10:00:00Z");

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneOffset getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(java.time.ZoneId zone) {
			return this;
		}

		void advance(Duration duration) {
			now = now.plus(duration);
		}
	}

	private TestClock clock;

	private EditLockRegistry registry;

	private UUID project;

	private UUID anna;

	private UUID bruno;

	@BeforeEach
	void setUp() {
		clock = new TestClock();
		registry = new EditLockRegistry(new EditLockProperties(TTL), clock);
		project = UUID.randomUUID();
		anna = UUID.randomUUID();
		bruno = UUID.randomUUID();
	}

	/**
	 * Die Registry ist ein eigenes Objekt je Test, das Aufraeumen also nicht
	 * noetig. Es steht trotzdem hier: die Klasse ist die Vorlage fuer den Tag,
	 * an dem jemand sie sich mit einem Spring-Kontext teilt, und dort waere
	 * ein vergessener Eintrag ein Fehler im naechsten Fall.
	 */
	@AfterEach
	void tearDown() {
		registry.clear();
	}

	@Nested
	@DisplayName("Beanspruchen und Erneuern")
	class Acquiring {

		@Test
		@DisplayName("Wer zuerst da ist, haelt: die zweite Person bekommt den Namen der ersten")
		void firstOneHolds() {
			EditLock first = registry.acquireOrRenew(project, anna, "Anna", "Beispiel");
			EditLock second = registry.acquireOrRenew(project, bruno, "Bruno", "Muster");

			assertThat(first.userId()).isEqualTo(anna);
			assertThat(second.userId()).isEqualTo(anna);
			assertThat(second.firstName()).isEqualTo("Anna");
			assertThat(second.lastName()).isEqualTo("Beispiel");
		}

		@Test
		@DisplayName("Der Herzschlag erneuert die Frist und laesst den Beginn stehen")
		void heartbeatKeepsTheBeginning() {
			Instant start = registry.acquireOrRenew(project, anna, "Anna", "Beispiel").since();

			clock.advance(Duration.ofSeconds(20));
			EditLock renewed = registry.acquireOrRenew(project, anna, "Anna", "Beispiel");

			// Der Beginn bleibt: sonst zeigte die wartende Sitzung bei jedem
			// Herzschlag "bearbeitet seit gerade eben".
			assertThat(renewed.since()).isEqualTo(start);
			assertThat(renewed.lastSeen()).isEqualTo(start.plusSeconds(20));

			// Und die Frist laeuft ab dem Herzschlag neu: nach weiteren 20
			// Sekunden sind es 40 seit Beginn, aber erst 20 seit dem Zeichen.
			clock.advance(Duration.ofSeconds(20));
			assertThat(registry.holder(project)).isPresent();
		}

		@Test
		@DisplayName("Jedes Projekt hat seine eigene Sperre")
		void locksAreScopedToTheProject() {
			UUID otherProject = UUID.randomUUID();

			registry.acquireOrRenew(project, anna, "Anna", "Beispiel");
			EditLock other = registry.acquireOrRenew(otherProject, bruno, "Bruno", "Muster");

			assertThat(other.userId()).isEqualTo(bruno);
		}
	}

	@Nested
	@DisplayName("Ablauf")
	class Expiry {

		@Test
		@DisplayName("Ohne Herzschlag faellt die Sperre nach der Frist von selbst frei")
		void expiresWithoutHeartbeat() {
			registry.acquireOrRenew(project, anna, "Anna", "Beispiel");

			clock.advance(TTL.minusSeconds(1));
			assertThat(registry.holder(project)).isPresent();

			clock.advance(Duration.ofSeconds(1));
			assertThat(registry.holder(project)).isEmpty();
		}

		@Test
		@DisplayName("Danach uebernimmt die wartende Person, ohne dass jemand etwas freigibt")
		void theWaitingOneTakesOver() {
			registry.acquireOrRenew(project, anna, "Anna", "Beispiel");
			clock.advance(TTL);

			EditLock taken = registry.acquireOrRenew(project, bruno, "Bruno", "Muster");

			assertThat(taken.userId()).isEqualTo(bruno);
			assertThat(taken.since()).isEqualTo(clock.instant());
		}
	}

	@Nested
	@DisplayName("Aufraeumen")
	class CleaningUp {

		@Test
		@DisplayName("Abgelaufene Eintraege verschwinden gelegentlich von selbst")
		void staleEntriesAreCollected() {
			/*
			 * Ohne dieses Aufraeumen bliebe je Projekt, das einmal bearbeitet
			 * und nie wieder geoeffnet wurde, ein toter Eintrag stehen. Der
			 * Durchlauf laeuft nicht bei jedem Zugriff, sondern alle
			 * CLEAN_UP_EVERY Aufrufe; er wird hier ueber viele Projekte
			 * ausgeloest.
			 */
			for (int i = 0; i < 250; i++) {
				registry.acquireOrRenew(UUID.randomUUID(), anna, "Anna", "Beispiel");
			}
			clock.advance(TTL.plusSeconds(1));

			/* Der naechste Schwung Zugriffe loest den Durchlauf aus. */
			for (int i = 0; i < 250; i++) {
				registry.holder(UUID.randomUUID());
			}

			assertThat(registry.size()).isZero();
		}
	}

	@Nested
	@DisplayName("Freigeben")
	class Releasing {

		@Test
		@DisplayName("Die eigene Sperre geht sofort weg")
		void ownLockIsReleased() {
			registry.acquireOrRenew(project, anna, "Anna", "Beispiel");

			registry.release(project, anna);

			assertThat(registry.holder(project)).isEmpty();
		}

		@Test
		@DisplayName("Eine fremde Sperre bricht das Freigeben nicht (§6.9)")
		void foreignLockSurvives() {
			registry.acquireOrRenew(project, anna, "Anna", "Beispiel");

			registry.release(project, bruno);

			assertThat(registry.holder(project)).isPresent();
			assertThat(registry.holder(project).orElseThrow().userId()).isEqualTo(anna);
		}

		@Test
		@DisplayName("Idempotent: zweimal freigeben und ohne gehaltene Sperre freigeben")
		void releaseIsIdempotent() {
			registry.acquireOrRenew(project, anna, "Anna", "Beispiel");

			registry.release(project, anna);
			registry.release(project, anna);
			registry.release(UUID.randomUUID(), anna);

			assertThat(registry.holder(project)).isEmpty();
		}
	}
}
