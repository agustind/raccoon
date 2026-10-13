# Raccoon

Self-hosted monitoring for Laravel apps, a clone of Laravel Nightwatch. Monitored apps keep the official `laravel/nightwatch` package and agent; the agent ships events here when the app sets `NIGHTWATCH_BASE_URL` to this app's URL and `NIGHTWATCH_TOKEN` to an environment token from this app. Those names belong to the package. Everywhere else, this project is Raccoon.

## Stack

- Laravel 13, Inertia 2, React 19, TypeScript, Tailwind 4, Recharts.
- ClickHouse holds events (one table per record type, `database/clickhouse/*.sql`, applied by `php artisan clickhouse:migrate`). Durations are microseconds everywhere.
- Postgres holds metadata: organizations, applications, environments (with tokens), deployments, issues, thresholds, webhooks.

## Agent protocol (must stay compatible)

- `POST /api/agent-auth` with `Authorization: Bearer <environment token>` returns `{token, expires_in, refresh_in, ingest_url}`.
- `POST /api/ingest` with the short-lived token and a gzipped `{"records":[...]}` body. A response may include `{"message", "stop", "refresh_in"}`; never send `stop: true` (no quotas).
- `POST /api/deployments` from `php artisan nightwatch:deploy`.
- Code: `app/Http/Controllers/Agent/AgentController.php`, `app/Ingest/*`. Record fields are defined by the package's sensors (`vendor/laravel/nightwatch/src/Sensors/*.php` in any app that installs it).

## Building a dashboard page

Backend:
- Controllers live in `app/Http/Controllers/Environment/` and extend `EnvironmentController`. Read it first; it has `period()`, `bindings()`, `scope()`, `bucket()`, `durationAggregates()`, `select()`, `selectFirst()`, `sort()`, `paginator()`, `cursorPaginator()`, `cursorWhere()`, `users()`.
- ClickHouse bindings use server-side parameters: write `{name:Type}` in SQL, pass `['name' => $value]`. Never interpolate request input into SQL. Sort columns come from an allow list via `sort()`.
- Charts: `Graph::fill($period, $rows, $emptyValues)` makes a dense series. Deploy markers: `Deployments::forPeriod()`.
- Detail pages for executions (request, command, job attempt, scheduled task) use `App\Queries\Traces` for the timeline, event summary, exceptions and logs.
- Wrap expensive props in `Inertia::defer(fn () => ..., '<group>')`: charts in one group, tables in another.
- ClickHouse resolves SELECT aliases before columns, also inside WHERE: after `any(host) AS host`, a filter on `host` hits the aggregate. Qualify the column (`outgoing_requests.host`) or pick another alias.
- Child events (queries, mail, logs...) link to their parent execution through the `Concerns\ResolvesExecutionSources` trait (`withExecutionUrls()`).
- Routes: each feature area owns one file. Environment pages go in `routes/environment/<area>.php` (auto-loaded, already prefixed `environments/{environment}` and named `environments.`). Other authenticated pages go in `routes/app/<area>.php`. Do not edit other areas' route files.
- Example to copy: `RequestController` + `routes/environment/requests.php`.

Frontend:
- Pages live in `resources/js/pages/<Area>/<Page>.tsx`, (`Jobs/Index`, `Jobs/Show`, `Jobs/Attempt`...).
- Never import one page from another. Shared pieces go in `resources/js/components/rc/`.
- Wrap pages in `EnvironmentLayout` (`resources/js/layouts/environment-layout.tsx`).
- Shared components in `resources/js/components/rc/`: `charts` (MetricCard, StackedBarChart, DurationLineChart, COLORS), `data-table` (DataTable, RowButton), `pagination`, `period-picker`, `user-filter`, `section` (Panel, Card, SectionHeader, Label, EmptyState), `key-value`, `badges`, `timeline`, `drawer`, `deferred`, `filter-tabs`, `search-input`, `code-block`, `timestamp`, `request-charts`, `execution-details` (deployment row, events summary, exceptions, logs, collapsible for execution pages), `source-link` (link to a parent execution). Helpers: `@/lib/format` (formatDuration takes microseconds), `@/lib/rc` (envUrl, visitWithQuery, withPeriod). Types: `@/types/raccoon`.
- Example to copy: `resources/js/pages/Requests/{Index,Route,Show}.tsx`.

## MCP server

`routes/ai.php` serves `App\Mcp\Servers\RaccoonServer` at `/mcp` (laravel/mcp), behind `auth:sanctum` personal access tokens created in Settings → Profile (`ApiTokenController`). Tools live in `app/Mcp/Tools/` and extend `RaccoonTool`, which resolves the environment the token's user may see and the period. Tools return Markdown (`App\Mcp\Support\Markdown`); `ExecutionReport` builds request and job attempt reports. Write tools check `$user->tokenCan('write')`. Tests: `tests/Feature/McpServerTest.php`.

## Deployment

Railway, defined in `.railway/railway.ts` (see `docs/railway.md`). One Docker image runs as `web` (`ROLE=web`) and `worker` (`ROLE=worker`: queue + scheduler). `APP_KEY` is generated on first boot and stored in Postgres when unset (`docker/app-key.php`).

## Local development

- Services: `docker compose up -d` (Postgres on 5544, ClickHouse on 8123). App: `php artisan serve --port=8000`. Assets: `npm run dev` (keep running; do not run `npm run build` while it runs).
- The first account you register owns a new organization. Later accounts need an invite or `RACCOON_ALLOW_REGISTRATION=true`.
- Inspect a page's props without a browser: `php artisan dev:inertia "/environments/<id>/requests?period=24h" --defer [--keys]`.
- Check pages without disturbing the person at the computer: `node scripts/screenshot.mjs [--dark] [--full] [--out dir] <path>...` runs Chrome headless, signs in with `SCREENSHOT_EMAIL`/`SCREENSHOT_PASSWORD`, saves PNGs (default `storage/screenshots/`) and prints console and HTTP errors per page. Never open a visible browser window, and keep dev servers in the background.
- Type check: `npx tsc --noEmit`. Lint: `npx eslint resources/js/<paths>`.
- Create an environment and print its token: `php artisan raccoon:environment "App" Production --user=<email>`.

## Conventions

- Match the surrounding code style. Comments explain why, sparingly.
