import { createBrowserRouter } from "react-router-dom";

import HomePage from "@/features/home/HomePage";
import TokenGalleryPage from "@/features/token-gallery/TokenGalleryPage";

/**
 * Routenbaum der Anwendung. Die fachlichen Routen entstehen mit ihren
 * Tickets; dieses Ticket (KAN-6) legt nur das Geruest an.
 *
 * /dev/tokens ist die Pruefflaeche der Tokenschicht (KAN-6, Abschnitt 7).
 * Sie bleibt dauerhaft bestehen, existiert aber nur im Entwicklungs-Build:
 * im Produktions-Build entfaellt die Route samt Seite.
 */
export const router = createBrowserRouter([
	{ path: "/", element: <HomePage /> },
	...(import.meta.env.DEV
		? [{ path: "/dev/tokens", element: <TokenGalleryPage /> }]
		: []),
]);
