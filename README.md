# Raccoon

Self-hosted monitoring for Laravel applications.

Raccoon is an open-source, self-hosted clone of [Laravel Nightwatch](https://nightwatch.laravel.com). Your apps keep the official `laravel/nightwatch` package and its agent. You point the agent at your Raccoon deployment instead of the hosted service, and your data stays on your own servers with no event quotas.

It covers requests and routes, jobs and attempts, commands, scheduled tasks, exceptions and issues, queries, cache, outgoing requests, mail, notifications, users, and logs. It also has performance thresholds, email and webhook alerts, organizations with roles and invites, and dark mode.

## Deploy

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/TEMPLATE_CODE)

The template creates four services: `web` (dashboard and ingest API), `worker` (queue and scheduler), Postgres, and ClickHouse with a volume. No variables are required. Details, sizing and self-publishing the template are in [docs/railway.md](docs/railway.md).

You can also run the Docker image anywhere. It needs Postgres and ClickHouse. Set `ROLE=web` or `ROLE=worker`, `DB_URL`, and the `CLICKHOUSE_*` variables from `.env.example`.

After deploying, open the web URL and create the first account. That account owns a new organization. Later sign-ups need an invite, or `RACCOON_ALLOW_REGISTRATION=true`.

## Connecting an app

Each environment of each application gets its own token. Create the application in the dashboard; the onboarding screen shows the first environment's token. Add more environments, such as Staging, under **Settings → Environments**.

In the monitored app:

1. Install the official package if it isn't there yet: `composer require laravel/nightwatch`.
2. Set the environment's variables. These names come from the package:

   ```bash
   NIGHTWATCH_TOKEN=<token from Settings → Environments>
   NIGHTWATCH_BASE_URL=https://<your Raccoon deployment>
   ```

3. Run the agent next to the app and keep it running: `php artisan nightwatch:agent`. The app hands events to it on `127.0.0.1:2407`, and it sends them to Raccoon about every 10 seconds.
4. Optionally, record deployments from your deploy script: `php artisan nightwatch:deploy`. It uses `NIGHTWATCH_DEPLOY`, or pass the deploy id as an argument.

Events show up within about 10 seconds. The agent's own log confirms each step: `Nightwatch agent initiated`, then `Authentication successful`, then `Ingest successful` per batch. A batch that fails is logged and dropped, not retried.

### Laravel Cloud

- Don't use Cloud's **Connect Nightwatch** action. It connects the environment to the hosted service, and Cloud's managed agent ignores `NIGHTWATCH_BASE_URL`. If an environment is already connected, disconnect it.
- Add the two variables to the environment's custom environment variables.
- On the **App cluster**, add a background process: **Custom worker**, command `php artisan nightwatch:agent`, **1 process**. Run exactly one per instance; a second agent can't bind the same port.
- Deploy.
- Cloud's **managed queue** runs workers outside the App cluster, where no agent is listening, so jobs processed there aren't captured. Jobs dispatched from requests still are. To capture them, run queue workers on a cluster where you can add the same background process.

### Other hosts

Run `php artisan nightwatch:agent` under your process manager (Supervisor, systemd, Forge daemons, a sidecar container) on every server or container that runs the app or its queue workers.

### Troubleshooting

- **Nothing arrives and the agent logs nothing:** the agent isn't running where the app runs, so events sent to `127.0.0.1:2407` are dropped.
- **`Authentication failed ... 401`:** the token doesn't match an environment. Copy it again from Settings → Environments.
- **`Incoming token hash mismatch`:** the app and the agent see different `NIGHTWATCH_TOKEN` values. Set it once for both, then restart both.
- **Requests arrive but jobs don't:** the queue workers run without an agent (see the managed queue note above).

## Webhooks

Webhooks are configured per application under **Settings → Issues**. Each delivery is a JSON `POST` of `{id, event, created_at, data}`. Events are `issue.created`, `issue.reopened`, `issue.resolved`, `issue.assigned` and `threshold.exceeded`. Verify it with the `X-Raccoon-Signature` header: `sha256=` followed by the hex HMAC-SHA256 of the raw body, keyed with the webhook's secret.

## Stack

Laravel 13, Inertia 2, React 19, TypeScript, Tailwind 4. Events live in ClickHouse, metadata (users, organizations, issues, settings) in Postgres.

## Local development

```bash
docker compose up -d            # Postgres on 5544, ClickHouse on 8123
composer install && npm install
cp .env.example .env && php artisan key:generate
php artisan migrate && php artisan clickhouse:migrate
php artisan serve               # http://localhost:8000
npm run dev
```

Create an environment and print its token from the command line:

```bash
php artisan raccoon:environment "My App" Production --user=you@example.com
```

Run the tests with `php artisan test`, type-check with `npx tsc --noEmit`.

## License

MIT. Raccoon isn't affiliated with Laravel. Laravel and Nightwatch are trademarks of their owners.
