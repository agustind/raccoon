<?php

use App\Http\Controllers\Environment\ScheduledTaskController;
use Illuminate\Support\Facades\Route;

Route::get('scheduled-tasks', [ScheduledTaskController::class, 'index'])->name('scheduled-tasks.index');
Route::get('scheduled-tasks/{group}', [ScheduledTaskController::class, 'show'])->name('scheduled-tasks.show');
Route::get('scheduled-tasks/{group}/{traceId}', [ScheduledTaskController::class, 'run'])->name('scheduled-tasks.run');
