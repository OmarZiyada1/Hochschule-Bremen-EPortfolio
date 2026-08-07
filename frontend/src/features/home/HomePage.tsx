import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

/**
 * Leere Startseite: die Anwendung laeuft vollstaendig konfiguriert, aber
 * ohne fachliche Ansicht (KAN-6). Die erste echte Seite entsteht mit den
 * Folge-Tickets.
 */
export default function HomePage() {
	const { t } = useTranslation();

	return (
		<main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 px-6">
			<h1 className="type-h1 text-foreground">{t("common.app.title")}</h1>
			<p className="type-body text-muted-foreground">{t("home.setupNotice")}</p>
			{import.meta.env.DEV ? (
				<Link
					to="/dev/tokens"
					className="type-body text-primary underline underline-offset-4 hover:text-primary-hover"
				>
					{t("home.tokenGalleryLink")}
				</Link>
			) : null}
		</main>
	);
}
