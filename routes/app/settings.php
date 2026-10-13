<?php

use App\Http\Controllers\Settings\ApplicationController;
use App\Http\Controllers\Settings\ApplicationEnvironmentController;
use App\Http\Controllers\Settings\IssueSettingsController;
use App\Http\Controllers\Settings\OrganizationController;
use App\Http\Controllers\Settings\OrganizationInviteController;
use App\Http\Controllers\Settings\OrganizationMemberController;
use App\Http\Controllers\Settings\ThresholdController;
use App\Http\Controllers\Settings\UsageController;
use App\Http\Controllers\Settings\WebhookController;
use Illuminate\Support\Facades\Route;

// Organization and application settings. Child models are scoped to their
// parent, so an application id from another organization 404s.
Route::prefix('settings/organizations/{organization}')->name('settings.organizations.')->scopeBindings()->group(function () {
    Route::get('/', [OrganizationController::class, 'edit'])->name('edit');
    Route::patch('/', [OrganizationController::class, 'update'])->name('update');
    Route::delete('/', [OrganizationController::class, 'destroy'])->name('destroy');
    Route::get('usage', [UsageController::class, 'show'])->name('usage');

    Route::post('invites', [OrganizationInviteController::class, 'store'])->name('invites.store');
    Route::post('invites/{invite}/resend', [OrganizationInviteController::class, 'resend'])->name('invites.resend');
    Route::delete('invites/{invite}', [OrganizationInviteController::class, 'destroy'])->name('invites.destroy');

    Route::patch('users/{user}', [OrganizationMemberController::class, 'update'])->name('users.update');
    Route::delete('users/{user}', [OrganizationMemberController::class, 'destroy'])->name('users.destroy');
});

Route::prefix('settings/organizations/{organization}/applications/{application}')->name('settings.applications.')->scopeBindings()->group(function () {
    Route::get('/', fn ($organization, $application) => to_route('settings.applications.general', [$organization, $application]));
    Route::get('general', [ApplicationController::class, 'general'])->name('general');
    Route::patch('/', [ApplicationController::class, 'update'])->name('update');
    Route::delete('/', [ApplicationController::class, 'destroy'])->name('destroy');

    Route::get('environments', [ApplicationEnvironmentController::class, 'index'])->name('environments');
    Route::post('environments', [ApplicationEnvironmentController::class, 'store'])->name('environments.store');
    Route::patch('environments/{environment}', [ApplicationEnvironmentController::class, 'update'])->name('environments.update');
    Route::post('environments/{environment}/refresh-token', [ApplicationEnvironmentController::class, 'refreshToken'])->name('environments.refresh-token');
    Route::delete('environments/{environment}', [ApplicationEnvironmentController::class, 'destroy'])->name('environments.destroy');

    Route::get('thresholds', [ThresholdController::class, 'index'])->name('thresholds');
    Route::post('thresholds', [ThresholdController::class, 'store'])->name('thresholds.store');
    Route::patch('thresholds/{threshold}', [ThresholdController::class, 'update'])->name('thresholds.update');
    Route::delete('thresholds/{threshold}', [ThresholdController::class, 'destroy'])->name('thresholds.destroy');

    Route::get('issues', [IssueSettingsController::class, 'edit'])->name('issues');
    Route::patch('issues', [IssueSettingsController::class, 'update'])->name('issues.update');

    Route::post('webhooks', [WebhookController::class, 'store'])->name('webhooks.store');
    Route::get('webhooks/{webhook}', [WebhookController::class, 'show'])->name('webhooks.show');
    Route::patch('webhooks/{webhook}', [WebhookController::class, 'update'])->name('webhooks.update');
    Route::post('webhooks/{webhook}/rotate-secret', [WebhookController::class, 'rotateSecret'])->name('webhooks.rotate-secret');
    Route::post('webhooks/{webhook}/test', [WebhookController::class, 'test'])->name('webhooks.test');
    Route::delete('webhooks/{webhook}', [WebhookController::class, 'destroy'])->name('webhooks.destroy');
});
