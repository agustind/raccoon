<?php

use App\Http\Middleware\AuthorizeEnvironment;
use App\Models\Environment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function (Request $request) {
    if (! $request->user()) {
        return redirect()->route('login');
    }

    $environment = Environment::find($request->session()->get('last_environment_id'))
        ?? Environment::whereHas('application.organization.users', fn ($q) => $q->whereKey($request->user()->id))->oldest()->first();

    return $environment
        ? redirect()->route('environments.dashboard', $environment)
        : redirect()->route('applications.create');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::prefix('environments/{environment}')
        ->middleware(AuthorizeEnvironment::class)
        ->name('environments.')
        ->group(base_path('routes/environment.php'));

    // Authenticated pages outside an environment (settings, onboarding...).
    // Each feature area owns one file in routes/app/.
    foreach (glob(__DIR__.'/app/*.php') as $file) {
        require $file;
    }
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
