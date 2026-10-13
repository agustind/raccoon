<?php

use App\Http\Controllers\Settings\NotificationPreferenceController;
use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use Illuminate\Support\Facades\Route;

// Personal settings. Organization and application settings live in
// routes/app/settings.php.
Route::middleware('auth')->group(function () {
    Route::redirect('settings', 'settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('settings/profile/email', [ProfileController::class, 'updateEmail'])->name('profile.email');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::put('settings/password', [PasswordController::class, 'update'])->name('password.update');

    Route::get('settings/notifications', [NotificationPreferenceController::class, 'edit'])->name('notifications.edit');
    Route::put('settings/notifications/environments/{environment}', [NotificationPreferenceController::class, 'update'])->name('notifications.update');
});
