# Deploying on Railway

The Railway project is defined in `.railway/railway.ts`: `web` and `worker` (both built from `Dockerfile`), `postgres`, and `clickhouse` (built from `docker/clickhouse/Dockerfile`, with a 10 GB volume (needs Railway Pro; Hobby caps volumes at 5 GB)), all in `us-east4-eqdc4a` (Virginia).

## First deploy

1. Push this repo to GitHub and set `REPOSITORY` in `.railway/railway.ts` to `<owner>/<repo>`.
2. Install the Railway GitHub app for that repo (Railway dashboard, Account, Integrations).
3. Run `scripts/railway-template.sh`, then set a random ClickHouse password once: `railway variables --service clickhouse --set CLICKHOUSE_PASSWORD=$(openssl rand -hex 24)`.
   The script It creates the project, shows the plan, applies it after you confirm, adds a public domain to `web`, and generates an unpublished template draft.
4. Open the `web` URL, sign up (the first user becomes the owner), create an application, and copy its token.

## Publishing the template

Run `scripts/railway-template.sh --publish`, or publish the draft from the dashboard. The marketplace overview comes from `.railway/TEMPLATE.md`. Check the draft in the template editor first:

- `clickhouse` → `CLICKHOUSE_PASSWORD` must be a generated secret: set it to `${{secret(32)}}` in the template editor. The project itself keeps a random value set once by hand (IaC uses `preserve()`), and that value must not ship in the template.
- `web` should have a generated public domain on port 8080.

Then add the "Deploy on Railway" button to the README with the template code Railway shows.

## Updating

Change `.railway/railway.ts`, then `railway config plan` and `railway config apply`. Code changes deploy on push to `main`.

## Connecting apps

Point each monitored app at the `web` domain. Setup for Laravel Cloud and other hosts is in the README, under [Connecting an app](../README.md#connecting-an-app).

## Sizing

An app sending about 8M events a month fits comfortably. Start with 1 GB RAM for `clickhouse` and 512 MB for `web` and `worker`; ClickHouse settings for small containers are in `docker/clickhouse/*.xml`.
