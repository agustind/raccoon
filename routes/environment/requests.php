<?php

use App\Http\Controllers\Environment\RequestController;
use Illuminate\Support\Facades\Route;

Route::get('requests', [RequestController::class, 'index'])->name('requests.index');
Route::get('requests/routes/{group}', [RequestController::class, 'route'])->name('requests.route');
Route::get('requests/{traceId}', [RequestController::class, 'show'])->name('requests.show');
