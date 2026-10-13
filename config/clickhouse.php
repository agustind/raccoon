<?php

return [
    'url' => env('CLICKHOUSE_URL', 'http://127.0.0.1:8123'),
    'database' => env('CLICKHOUSE_DATABASE', 'raccoon'),
    'username' => env('CLICKHOUSE_USERNAME', 'default'),
    'password' => env('CLICKHOUSE_PASSWORD', ''),
    'timeout' => env('CLICKHOUSE_TIMEOUT', 30),
    'retention_days' => (int) env('CLICKHOUSE_RETENTION_DAYS', 30),
];
