<?php

use App\Http\Controllers\Environment\JobController;
use Illuminate\Support\Facades\Route;

Route::get('jobs', [JobController::class, 'index'])->name('jobs.index');
Route::get('jobs/attempts/{group}/{jobId}/{attemptId}', [JobController::class, 'attempt'])->name('jobs.attempt');
Route::get('jobs/{group}', [JobController::class, 'show'])->name('jobs.show');
