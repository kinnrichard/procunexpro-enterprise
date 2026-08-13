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

Deploys reuse the same DigitalOcean droplet (`167.71.214.238`, root) and repo
secrets as dentro. Host + deploy path are hardcoded in the workflow files;
`DEPLOY_PATH` per env is `/root/procunex-<env>`.

**Repo secrets** (already present, shared with dentro):
- `DENTRO_SSH_KEY` — private SSH key for the droplet
- `GHCR_TOKEN` — PAT with `read:packages` for `docker login ghcr.io` on the server

**Environment variables** (repo → Settings → Environments → `development`/`staging`/`production`):
- `NEXT_PUBLIC_API_URL` — public API URL, baked into the web image. Set:
  - staging → `https://staging.procunexpro.com/api`
  - production → `https://app.procunexpro.com/api`
  - development → (set when a dev domain exists)

> Protect the **production** environment with **required reviewers** to gate prod deploys.

## 2. Server prep (once per environment)

Same droplet as the other apps (dentro etc.). Ingress + TLS are handled by the
shared **Traefik** proxy — the compose attaches to the external `traefik_network`
and Traefik issues Let's Encrypt certs from the container labels. No host ports,
no nginx.

Traefik already runs on the droplet (external `traefik_network`, `websecure`
entrypoint, `letsencrypt` resolver). Per env, create `/root/procunex-<env>`:

```bash
# STAGING example
mkdir -p /root/procunex-staging && cd /root/procunex-staging
cp <repo>/docker/docker-compose.prod.yml .
cp <repo>/docker/.env.example .env      # then edit:
#   COMPOSE_PROJECT_NAME=procunex-staging
#   IMAGE_TAG=staging
#   APP_DOMAIN=staging.procunexpro.com
#   POSTGRES_PASSWORD=... JWT_SECRET=...
# PRODUCTION: /root/procunex-production, IMAGE_TAG=production, APP_DOMAIN=app.procunexpro.com
```

DNS: `staging.procunexpro.com` and `app.procunexpro.com` A-records → the droplet.
Traefik handles the cert + routing (web at `/`, api at `/api`, uploads at `/uploads`).

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
