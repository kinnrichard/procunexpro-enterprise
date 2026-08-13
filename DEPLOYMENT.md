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
- `NEXT_PUBLIC_API_URL` — public API URL for that env (baked into the web image at build time), e.g. `https://staging-api.procunex.example.com/api`

> Protect the **production** environment with **required reviewers** to gate prod deploys.

## 2. Server prep (once per environment)

```bash
# Docker + compose plugin installed
mkdir -p /srv/procunex-staging && cd /srv/procunex-staging      # = DEPLOY_PATH
# copy the compose file from the repo (docker/docker-compose.prod.yml) here
cp .env.example .env    # from docker/.env.example — fill in per-env values
# COMPOSE_PROJECT_NAME, IMAGE_TAG (development|staging|production),
# API_PORT / WEB_PORT (unique per env), POSTGRES_PASSWORD, JWT_SECRET, FRONTEND_URL
```

Put a reverse proxy (nginx/Caddy) in front, routing each env's domain to its
`WEB_PORT`, and the API domain to its `API_PORT`.

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
- Postgres + Redis run inside each env's compose (isolated volumes per
  `COMPOSE_PROJECT_NAME`). Swap to a managed DB by editing the compose + `DATABASE_URL`.
- Images are multi-arch-agnostic (built on `ubuntu-latest` = amd64). Ensure the VPS is amd64.
- Schema changes deploy via `prisma db push` (this project has no migration files).
