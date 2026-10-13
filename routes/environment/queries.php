<?php

use App\Http\Controllers\Environment\QueryController;
use Illuminate\Support\Facades\Route;

Route::get('queries', [QueryController::class, 'index'])->name('queries.index');
Route::get('queries/{group}', [QueryController::class, 'show'])->name('queries.show');
