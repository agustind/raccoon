<?php

namespace App\Console\Commands;

use App\ClickHouse\ClickHouse;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class ClickHouseMigrate extends Command
{
    protected $signature = 'clickhouse:migrate {--fresh : Drop every table in the ClickHouse database first}';

    protected $description = 'Apply the SQL files in database/clickhouse to ClickHouse';

    public function handle(ClickHouse $clickhouse): int
    {
        // The server image only creates CLICKHOUSE_DB on a fresh volume.
        $clickhouse->ensureDatabase();

        if ($this->option('fresh')) {
            foreach ($clickhouse->select('SELECT name FROM system.tables WHERE database = currentDatabase()') as $table) {
                $clickhouse->statement("DROP TABLE IF EXISTS `{$table['name']}`");
            }
        }

        $clickhouse->statement('CREATE TABLE IF NOT EXISTS migrations (name String, applied_at DateTime DEFAULT now()) ENGINE = MergeTree ORDER BY name');

        $applied = array_column($clickhouse->select('SELECT name FROM migrations'), 'name');
        $retention = (int) config('clickhouse.retention_days');

        foreach (File::glob(database_path('clickhouse/*.sql')) as $path) {
            $name = basename($path);

            if (in_array($name, $applied, true)) {
                continue;
            }

            $sql = str_replace('{retention_days}', (string) $retention, File::get($path));

            foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
                $clickhouse->statement($statement);
            }

            $clickhouse->insert('migrations', [['name' => $name]]);
            $this->components->info("Migrated {$name}");
        }

        return self::SUCCESS;
    }
}
