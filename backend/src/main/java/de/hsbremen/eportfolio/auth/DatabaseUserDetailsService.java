package de.hsbremen.eportfolio.auth;

import de.hsbremen.eportfolio.user.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Laedt ein Konto anhand der <strong>privaten</strong> E-Mail-Adresse
 * ({@code User.email}).
 *
 * <p>Die HSB-Adresse wird hier bewusst <em>nicht</em> herangezogen. Sie belegt
 * einmalig bei der Registrierung die Hochschulzugehoerigkeit (§3.1.1); der
 * Login liegt auf der privaten Adresse, damit ein Praesentationsportfolio auch
 * nach der Exmatrikulation zugaenglich bleibt. Ein Login-Versuch mit der
 * HSB-Adresse muss deshalb fehlschlagen. {@code UserRepository.findByHsbEmail}
 * existiert, gehoert aber in den Registrierungsflow, nicht hierher.
 *
 * <p>Der Name traegt das Praefix {@code Database}, weil Spring Security selbst
 * ein Interface {@code UserDetailsService} mitbringt, das diese Klasse
 * implementiert (docs/NAMENSSCHEMA.md §8).
 */
@Service
public class DatabaseUserDetailsService implements UserDetailsService {

	private final UserRepository userRepository;

	public DatabaseUserDetailsService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	@Override
	@Transactional(readOnly = true)
	public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
		return userRepository.findByEmail(email)
				.map(AuthenticatedUser::from)
				.orElseThrow(() -> new UsernameNotFoundException(
						"Kein Konto zu dieser E-Mail-Adresse."));
	}
}
