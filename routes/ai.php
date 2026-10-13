<?php

use App\Mcp\Servers\RaccoonServer;
use Laravel\Mcp\Facades\Mcp;

// MCP server for AI agents. Authenticate with a personal API token
// (Settings → Profile): Authorization: Bearer <token>.
Mcp::web('/mcp', RaccoonServer::class)->middleware(['auth:sanctum', 'throttle:120,1']);
