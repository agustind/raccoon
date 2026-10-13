<?php

use App\Http\Controllers\Environment\OutgoingRequestController;
use Illuminate\Support\Facades\Route;

Route::get('outgoing-requests', [OutgoingRequestController::class, 'index'])->name('outgoing-requests.index');
Route::get('outgoing-requests/{group}', [OutgoingRequestController::class, 'show'])->name('outgoing-requests.show');
