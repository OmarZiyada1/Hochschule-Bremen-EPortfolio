package de.hsbremen.eportfolio.admin;

import de.hsbremen.eportfolio.admin.dto.DashboardResponse;
import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/admin/dashboard} aus API-Contract §6.1 (KAN-25).
 *
 * <p><strong>Die Rollenebene liegt in der Filterkette</strong>, wie beim
 * {@code Top10AdminController}: {@code SecurityConfig} fuehrt
 * {@code /api/admin/**} mit {@code hasRole("ADMIN")}, ohne Token endet ein
 * Aufruf mit 401, mit fremdem Token mit 403. Der Dienst prueft
 * {@code maySeeAdminDashboard} trotzdem noch einmal, weil die Hausregel
 * Berechtigungen zweistufig fuehrt und ein Pfadmuster keine Rechtematrix ist
 * (§5).
 */
@RestController
@RequestMapping("/api/admin")
@Tag(name = "Administrationsseite", description = "Kennzahlen der Administrationsseite (§6.1). "
		+ "Ausschliesslich fuer ADMIN (§5).")
public class AdminDashboardController {

	private final AdminDashboardService dashboardService;

	public AdminDashboardController(AdminDashboardService dashboardService) {
		this.dashboardService = dashboardService;
	}

	@Operation(summary = "Dashboard-Kennzahlen lesen",
			description = "Projekte je Status und je Fakultaet, Konten insgesamt sowie je "
					+ "Rolle und Status, offene Top-10-Nominierungen und Inhaltsbloecke je "
					+ "Typ. Jede Aufschluesselung ist vollstaendig: die Enum-Karten tragen "
					+ "alle Werte ihres Enums, projectsByFaculty jede Fakultaet, beides "
					+ "auch mit dem Wert 0. Projekte ohne Fakultaet gehen in "
					+ "projectsByFaculty nicht ein; die Summe dort ist also nicht die "
					+ "Gesamtzahl der Projekte. Alle Zahlen sind Bestandsgroessen zum "
					+ "Zeitpunkt des Aufrufs.")
	@ApiResponse(responseCode = "200", description = "Die Kennzahlen.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@GetMapping("/dashboard")
	public DashboardResponse dashboard(@AuthenticationPrincipal AuthenticatedUser user) {
		return dashboardService.dashboard(user);
	}
}
