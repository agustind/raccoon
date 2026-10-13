<?php

use App\Http\Controllers\Agent\AgentController;
use Illuminate\Support\Facades\Route;

// Endpoints used by the stock laravel/nightwatch agent.
Route::post('agent-auth', [AgentController::class, 'authenticate']);
Route::post('ingest', [AgentController::class, 'ingest']);
Route::post('deployments', [AgentController::class, 'deployment']);
