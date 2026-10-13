<?php

use App\Http\Controllers\Environment\MailController;
use Illuminate\Support\Facades\Route;

Route::get('mail', [MailController::class, 'index'])->name('mail.index');
Route::get('mail/{group}', [MailController::class, 'show'])->name('mail.show');
