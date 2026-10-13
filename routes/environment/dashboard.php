<?php

use App\Http\Controllers\Environment\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('dashboard', [DashboardController::class, 'show'])->name('dashboard');
