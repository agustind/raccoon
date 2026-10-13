# Deploy and Host Raccoon with Railway

Raccoon is an open-source, self-hosted clone of [Laravel Nightwatch](https://nightwatch.laravel.com) for monitoring Laravel apps. Your apps keep the official `laravel/nightwatch` package and agent; you point the agent at your own deployment.

## About Hosting Raccoon

The template deploys four services in one Railway project:

- **web**: the dashboard and the agent ingest API (Laravel 13, FrankenPHP).
- **worker**: queue worker and scheduler (alerts, webhooks, performance thresholds).
- **postgres**: users, organizations, applications, issues and settings.
- **clickhouse**: every event your apps send (requests, jobs, queries, exceptions, logs, mail, cache...), kept for 30 days.

The app key and the ClickHouse password are generated on first deploy. No variables are required.

## Common Use Cases

- Keep Laravel monitoring data in your own infrastructure instead of a hosted service.
- Monitor several Laravel apps and environments from one dashboard, with no event quotas.
- Keep monitoring data in the same region as your app for lower agent latency.

## Dependencies for Raccoon Hosting

- A Laravel 10+ app with `laravel/nightwatch` installed.
- The package's agent running next to your app (`php artisan nightwatch:agent`).

### Deployment Dependencies

- [laravel/nightwatch package](https://github.com/laravel/nightwatch) (the agent)
- [ClickHouse](https://clickhouse.com)

### Implementation Details

After the deploy finishes:

1. Open the web service URL and create your account (the first account becomes the owner).
2. Create an application. The setup screen shows its token.
3. In your Laravel app's environment set:

```bash
NIGHTWATCH_TOKEN=<token from the setup screen>
NIGHTWATCH_BASE_URL=https://<your web service domain>
```

4. Restart `php artisan nightwatch:agent`. Events appear within about 10 seconds.

Optionally run `php artisan nightwatch:deploy` in your deploy script to mark deployments on charts.

## Why Deploy Raccoon on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Raccoon on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
