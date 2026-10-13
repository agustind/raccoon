# syntax=docker/dockerfile:1

# --- Composer dependencies -------------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative

# --- Frontend assets -------------------------------------------------------
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
COPY --from=vendor /app/vendor ./vendor
RUN rm -f public/hot && npm run build

# --- Runtime ---------------------------------------------------------------
FROM dunglas/frankenphp:1-php8.4-bookworm
RUN install-php-extensions pdo_pgsql pgsql pcntl intl zip opcache bcmath redis \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php.ini $PHP_INI_DIR/conf.d/zz-app.ini
COPY docker/Caddyfile /etc/caddy/Caddyfile

WORKDIR /app
COPY --from=vendor /app /app
COPY --from=assets /app/public/build /app/public/build
RUN rm -rf reference public/hot tests node_modules \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

ENV APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr PORT=8080
EXPOSE 8080

# ROLE=web (default) serves HTTP; ROLE=worker runs the queue and scheduler.
ENTRYPOINT ["entrypoint"]
