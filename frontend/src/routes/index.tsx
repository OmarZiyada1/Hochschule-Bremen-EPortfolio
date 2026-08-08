import { createBrowserRouter } from "react-router-dom"

import HomePage from "@/features/home/HomePage"
import TokenGalleryPage from "@/features/token-gallery/TokenGalleryPage"

/**
 * Routenbaum der Anwendung. Die fachlichen Routen entstehen mit ihren
 * Tickets; KAN-6 legt nur das Geruest an.
 *
 * /dev/tokens ist die Pruefflaeche der Tokenschicht (KAN-6, Abschnitt 8).
 * Sie bleibt dauerhaft im Repository und ist bei jedem "pnpm dev" da,
 * existiert aber nur im Entwicklungs-Build: import.meta.env.DEV ist im
 * Produktions-Build eine Konstante, der Zweig faellt beim Buendeln weg.
 */
export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  ...(import.meta.env.DEV
    ? [{ path: "/dev/tokens", element: <TokenGalleryPage /> }]
    : []),
])
