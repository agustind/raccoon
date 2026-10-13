<?php

use App\Http\Controllers\Environment\CacheController;
use Illuminate\Support\Facades\Route;

Route::get('cache', [CacheController::class, 'index'])->name('cache.index');
