<?php

use App\Http\Controllers\Onboarding\ApplicationController;
use App\Http\Controllers\Onboarding\InviteController;
use App\Http\Controllers\Onboarding\OrganizationController;
use Illuminate\Support\Facades\Route;

Route::get('organizations/create', [OrganizationController::class, 'create'])->name('organizations.create');
Route::post('organizations', [OrganizationController::class, 'store'])->name('organizations.store');

Route::get('applications/create', [ApplicationController::class, 'create'])->name('applications.create');
Route::post('applications', [ApplicationController::class, 'store'])->name('applications.store');

// The invite page itself is public, see routes/auth.php.
Route::post('invites/{token}/accept', [InviteController::class, 'accept'])->name('invites.accept');
