package de.hsbremen.eportfolio.reaction;

import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.user.User;

/**
 * Baut {@link Reaction}-Instanzen fuer Tests.
 *
 * <p>Liegt in diesem Paket, weil der Konstruktor von {@code Reaction} JPA
 * vorbehalten ist, dieselbe Begruendung wie bei {@code TestProject}. Die
 * {@code id} bleibt leer, damit {@code save} die Zeile wirklich einfuegt.
 */
public final class TestReaction {

	public static Reaction withoutId(Project project, User user) {
		Reaction reaction = new Reaction();
		reaction.setProject(project);
		reaction.setUser(user);
		return reaction;
	}

	private TestReaction() {
	}
}
