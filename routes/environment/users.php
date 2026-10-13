<?php

use App\Http\Controllers\Environment\UserController;
use Illuminate\Support\Facades\Route;

Route::get('users', [UserController::class, 'index'])->name('users.index');
Route::get('users/{user}', [UserController::class, 'show'])->name('users.show');
