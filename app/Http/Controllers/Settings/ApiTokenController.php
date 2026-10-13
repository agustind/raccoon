<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Personal API tokens for the MCP server (/mcp). A token sees the same
 * organizations as its user; write access lets agents update issues.
 */
class ApiTokenController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'write' => ['boolean'],
        ]);

        $token = $request->user()->createToken($data['name'], ($data['write'] ?? false) ? ['read', 'write'] : ['read']);

        // Shown once on the next page load; only its hash is stored.
        return back()->with('api_token', $token->plainTextToken);
    }

    public function destroy(Request $request, int $token): RedirectResponse
    {
        $request->user()->tokens()->whereKey($token)->delete();

        return back()->with('success', 'Token revoked.');
    }
}
