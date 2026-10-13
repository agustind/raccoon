#!/bin/sh
set -e
cd /app

APP_KEY="$(php docker/app-key.php)"
export APP_KEY

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

case "${ROLE:-web}" in
  web)
    php artisan migrate --force
    # ClickHouse may still be starting on a fresh deploy. Serve anyway after a
    # minute: the agent retries failed batches, and migrations run next boot.
    for attempt in $(seq 1 12); do
      php artisan clickhouse:migrate && break
      echo "ClickHouse not ready (attempt ${attempt}), retrying in 5s..."
      sleep 5
    done
    exec frankenphp run --config /etc/caddy/Caddyfile
    ;;
  worker)
    # Scheduler (threshold checks) in the background, queue worker in front.
    php artisan schedule:work &
    exec php artisan queue:work --sleep=1 --tries=3 --max-time=3600
    ;;
  *)
    exec "$@"
    ;;
esac
