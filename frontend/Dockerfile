# syntax=docker/dockerfile:1
#
# Vier Stufen fuer zwei Betriebsarten:
#   base    Node plus Corepack
#   dev     Vite-Dev-Server, Quellcode und node_modules kommen als Mount
#   build   erzeugt dist/ (nur Zwischenstufe)
#   runtime nginx liefert dist/ aus und leitet die API ans Backend weiter
#
# Basis ist bewusst bookworm-slim und nicht Alpine: @tailwindcss/oxide
# uebersetzt beim Installieren eine native Bibliothek gegen glibc
# (siehe allowBuilds in pnpm-workspace.yaml).

# --------------------------------------------------------------------------
# Stufe base
# --------------------------------------------------------------------------
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Nur im Image, nicht projektweit: pnpm weist sonst jedes Paket ab, das
# juenger als 24 Stunden ist, und der Bau schlaegt nach jeder Aktualisierung
# einen Tag lang fehl. Der Schutz zielt auf das Aufloesen neuer Versionen;
# das findet hier nicht statt, das Lockfile ist eingefroren und bringt seine
# Pruefsummen mit. Beim "pnpm add" auf dem Rechner der Entwickler greift die
# Regel unveraendert.
#
# Als Umgebungsvariable und nicht als Schalter am Aufruf, weil jeder
# pnpm-Befehl vorab noch einmal selbst "pnpm install" startet und ein
# Schalter dorthin nicht durchgereicht wird.
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0

# Corepack liest die pnpm-Version aus dem Feld packageManager der package.json.
RUN corepack enable
WORKDIR /app

# --------------------------------------------------------------------------
# Stufe dev
# --------------------------------------------------------------------------
# Bewusst leer: Quellcode und node_modules kommen zur Laufzeit aus
# docker-compose.override.yml. node_modules darf nie vom Host stammen, weil
# die native Bibliothek von Tailwind dort fuer Windows uebersetzt ist.
FROM base AS dev
EXPOSE 5173
CMD ["pnpm", "dev"]

# --------------------------------------------------------------------------
# Stufe build
# --------------------------------------------------------------------------
FROM base AS build

# Erst die Manifeste: die Installationsschicht bleibt im Cache, solange sich
# nur Quellcode aendert.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# --------------------------------------------------------------------------
# Stufe runtime
# --------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
