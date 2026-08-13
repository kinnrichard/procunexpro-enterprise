# Deployment

CI/CD via GitHub Actions. Branch → environment:

| Branch        | Workflow                | Environment  | Image tag     |
| ------------- | ----------------------- | ------------ | ------------- |
| `development` | `deploy-development.yml` | development  | `development` |
| `staging`     | `deploy-staging.yml`    | staging      | `staging`     |
| `production`  | `deploy-production.yml` | production   | `production`  |

Each deploy: build **api** + **web** Docker images → push to **GHCR**
(`ghcr.io/kinnrichard/procunexpro-enterprise/{api,web}`) → SSH to the VPS →
`docker compose -f docker-compose.prod.yml up -d`. `CI` runs build + prisma
generate on PRs and pushes.

## 1. GitHub configuration

Create three **Environments** (repo → Settings → Environments): `development`,
`staging`, `production`. In each, set:

**Secrets**
- `VPS_HOST` — server IP / hostname
- `VPS_USER` — SSH user (e.g. `root`)
- `VPS_PORT` — SSH port (optional, default 22)
- `VPS_SSH_KEY` — private SSH key whose public key is in the server's `authorized_keys`
- `DEPLOY_PATH` — directory on the server holding `docker-compose.prod.yml` + `.env`
- `GHCR_TOKEN` — a PAT (classic) with `read:packages`, so the server can `docker login ghcr.io`

**Variables**
- `NEXT_PUBLIC_API_URL` — public API URL for that env (baked into the web image at build time). With the Traefik setup this is `https://<APP_DOMAIN>/api`, e.g. `https://staging.procunex.example.com/api`

> Protect the **production** environment with **required reviewers** to gate prod deploys.

## 2. Server prep (once per environment)

Same droplet as the other apps (dentro etc.). Ingress + TLS are handled by the
shared **Traefik** proxy — the compose attaches to the external `traefik_network`
and Traefik issues Let's Encrypt certs from the container labels. No host ports,
no nginx.

```bash
# Prereqs on the droplet (already present if Traefik/dentro run there):
#   - Docker + compose plugin
#   - a running Traefik with: external network `traefik_network`,
#     `websecure` entrypoint, and a `letsencrypt` certresolver
mkdir -p /srv/procunex-staging && cd /srv/procunex-staging      # = DEPLOY_PATH
cp <repo>/docker/docker-compose.prod.yml .
cp <repo>/docker/.env.example .env       # fill per-env values:
#   COMPOSE_PROJECT_NAME (procunex-staging), IMAGE_TAG (staging),
#   APP_DOMAIN (staging.procunex...), POSTGRES_PASSWORD, JWT_SECRET
```

Point the env's DNS **A-record** (`APP_DOMAIN`) at the droplet — Traefik does
the cert + routing (web at `/`, api at `/api`, uploads at `/uploads`).

## 3. First deploy

Push to the branch (or run the workflow manually via **workflow_dispatch**).
The workflow builds, pushes, and deploys. On first run the DB schema is applied
via `prisma db push`.

**Seed the first tenant/admin** (one-off, since the seed script is a dev dep):
```bash
cd $DEPLOY_PATH
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
  psql -U postgres -d procunexpro_enterprise -c "..."   # or run a seed manually
```
(Default dev seed = org `Demo` / `admin` / `admin123!`.)

## Notes
- Mirrors the dentro DigitalOcean setup: **Traefik** reverse proxy + auto TLS via
  container labels on the external `traefik_network`. Router names are prefixed with
  `COMPOSE_PROJECT_NAME` so multiple envs/apps coexist on one droplet.
- Postgres + Redis run inside each env's compose (isolated volumes per
  `COMPOSE_PROJECT_NAME`). Swap to a managed DB by editing the compose + `DATABASE_URL`.
- Images build on `ubuntu-latest` (amd64) — ensure the droplet is amd64.
- Schema changes deploy via `prisma db push` (this project has no migration files).
