<?php

// Prints the APP_KEY to use. When APP_KEY is not set (one-click Railway
// template deploys), the first container to boot generates one and stores it
// in Postgres so the web and worker services share the same key.
// Runs before Laravel boots, so it only uses PDO.

if (($key = getenv('APP_KEY')) !== false && $key !== '') {
    echo $key;
    exit(0);
}

$url = getenv('DB_URL') ?: getenv('DATABASE_URL') ?: '';

if ($url !== '') {
    $parts = parse_url($url);
    $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $parts['host'], $parts['port'] ?? 5432, ltrim($parts['path'] ?? '/postgres', '/'));
    $user = urldecode($parts['user'] ?? '');
    $password = urldecode($parts['pass'] ?? '');
} else {
    $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', getenv('DB_HOST') ?: '127.0.0.1', getenv('DB_PORT') ?: '5432', getenv('DB_DATABASE') ?: 'laravel');
    $user = getenv('DB_USERNAME') ?: '';
    $password = getenv('DB_PASSWORD') ?: '';
}

$attempts = 0;

while (true) {
    try {
        $pdo = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        break;
    } catch (PDOException $e) {
        // The database may still be starting on a fresh deploy.
        if (++$attempts >= 30) {
            fwrite(STDERR, 'app-key: cannot connect to Postgres: '.$e->getMessage().PHP_EOL);
            exit(1);
        }
        sleep(2);
    }
}

$pdo->exec('CREATE TABLE IF NOT EXISTS app_secrets (name varchar(64) PRIMARY KEY, value text NOT NULL)');
$pdo->prepare('INSERT INTO app_secrets (name, value) VALUES (?, ?) ON CONFLICT (name) DO NOTHING')
    ->execute(['app_key', 'base64:'.base64_encode(random_bytes(32))]);

$statement = $pdo->prepare('SELECT value FROM app_secrets WHERE name = ?');
$statement->execute(['app_key']);

echo $statement->fetchColumn();
