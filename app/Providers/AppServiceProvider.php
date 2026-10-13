<?php

namespace App\Providers;

use App\ClickHouse\ClickHouse;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(ClickHouse::class, fn () => new ClickHouse(
            url: rtrim(config('clickhouse.url'), '/'),
            database: config('clickhouse.database'),
            username: config('clickhouse.username'),
            password: (string) config('clickhouse.password'),
            timeout: (int) config('clickhouse.timeout'),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        //
    }
}
