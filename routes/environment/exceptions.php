<?php

use App\Http\Controllers\Environment\ExceptionController;
use Illuminate\Support\Facades\Route;

Route::get('exceptions', [ExceptionController::class, 'index'])->name('exceptions.index');
Route::get('exceptions/{group}', [ExceptionController::class, 'show'])->name('exceptions.show');
