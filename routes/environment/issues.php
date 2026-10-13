<?php

use App\Http\Controllers\Environment\IssueController;
use Illuminate\Support\Facades\Route;

Route::get('issues', [IssueController::class, 'redirect'])->name('issues');
Route::post('issues/bulk-update', [IssueController::class, 'bulkUpdate'])->name('issues.bulk-update');
Route::get('issues/{type}', [IssueController::class, 'index'])->whereIn('type', ['exceptions', 'performance'])->name('issues.index');
Route::get('issues/{issue}', [IssueController::class, 'show'])->whereNumber('issue')->name('issues.show');
Route::patch('issues/{issue}', [IssueController::class, 'update'])->whereNumber('issue')->name('issues.update');
Route::post('issues/{issue}/comments', [IssueController::class, 'comment'])->whereNumber('issue')->name('issues.comments.store');
Route::patch('issues/{issue}/comments/{activity}', [IssueController::class, 'updateComment'])->whereNumber('issue')->name('issues.comments.update');
Route::delete('issues/{issue}/comments/{activity}', [IssueController::class, 'destroyComment'])->whereNumber('issue')->name('issues.comments.destroy');
Route::post('issues/{issue}/subscription', [IssueController::class, 'subscribe'])->whereNumber('issue')->name('issues.subscribe');
Route::delete('issues/{issue}/subscription', [IssueController::class, 'unsubscribe'])->whereNumber('issue')->name('issues.unsubscribe');
