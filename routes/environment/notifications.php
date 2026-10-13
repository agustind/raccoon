<?php

use App\Http\Controllers\Environment\NotificationController;
use Illuminate\Support\Facades\Route;

Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
Route::get('notifications/{group}', [NotificationController::class, 'show'])->name('notifications.show');
