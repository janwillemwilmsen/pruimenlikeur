# Pruimenlikeur Proeverij

Tasting feedback app for homemade plum liqueurs. Guests pick how many they tasted, select the flavours,
score them 1-10 with comments, and get a silly thank-you page. `/admin` manages liqueurs (name, photo,
ingredients), shows results and exports CSV. Zero npm dependencies: Node's built-in `node:sqlite`.

## Run locally

    ADMIN_PASSWORD=secret node --experimental-sqlite server.js
	$env:ADMIN_PASSWORD = "secret"; node --experimental-sqlite server.js

(Node >= 22.5; the flag is a harmless no-op on newer versions.) Open http://localhost:3000 and http://localhost:3000/admin.

## Deploy on Coolify

1. New resource -> your Git repo -> Build Pack **Nixpacks** (uses `nixpacks.toml`). Port **3000**.
2. Environment variables: `ADMIN_PASSWORD` (required), `DATA_DIR=/data`, optional `SESSION_SECRET`.
3. **Persistent storage:** add a volume mounted at `/data`. It holds the SQLite database and the uploaded photos.
4. Deploy. Put the domain behind HTTPS (Coolify does this by default).

A `Dockerfile` is included as an alternative build pack.

Backup: copy `/data` (`pruimenlikeur.db*` and `uploads/`).
