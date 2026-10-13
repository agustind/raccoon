<?php

use App\Http\Controllers\Environment\CommandController;
use Illuminate\Support\Facades\Route;

Route::get('commands', [CommandController::class, 'index'])->name('commands.index');
Route::get('commands/{group}', [CommandController::class, 'show'])->name('commands.show');
Route::get('commands/{group}/{traceId}', [CommandController::class, 'execution'])->name('commands.execution');
