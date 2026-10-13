<?php

namespace App\Console\Commands;

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

/**
 * Local development helper: render an Inertia page as JSON for a user,
 * including deferred props, without a browser.
 */
class InertiaProbe extends Command
{
    protected $signature = 'dev:inertia {path} {--user= : Email of the user to act as} {--defer : Also load every deferred prop group} {--keys : Print prop keys and sizes only}';

    protected $description = 'Print the Inertia JSON for a page (local only)';

    public function handle(Kernel $kernel): int
    {
        if (! app()->environment('local', 'testing')) {
            $this->error('Only available locally.');

            return self::FAILURE;
        }

        $user = $this->option('user') ? User::where('email', $this->option('user'))->firstOrFail() : User::firstOrFail();
        $page = $this->fetch($kernel, $user, $this->argument('path'));

        if (! is_array($page)) {
            $this->line((string) $page);

            return self::FAILURE;
        }

        if ($this->option('defer')) {
            foreach ($page['deferredProps'] ?? [] as $keys) {
                $partial = $this->fetch($kernel, $user, $this->argument('path'), $page['component'], implode(',', $keys));

                if (! is_array($partial)) {
                    $this->line((string) $partial);

                    return self::FAILURE;
                }

                foreach ($keys as $key) {
                    $page['props'][$key] = $partial['props'][$key] ?? null;
                }
            }
        }

        unset($page['props']['auth']);

        if ($this->option('keys')) {
            $this->line($page['component']);

            foreach ($page['props'] as $key => $value) {
                $this->line(sprintf('  %-28s %s', $key, strlen(json_encode($value))));
            }

            return self::SUCCESS;
        }

        $this->line(json_encode($page, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return self::SUCCESS;
    }

    private function fetch(Kernel $kernel, User $user, string $path, ?string $component = null, ?string $only = null): array|string
    {
        $server = [
            'HTTP_X_INERTIA' => 'true',
            'HTTP_X_INERTIA_VERSION' => (string) app(HandleInertiaRequests::class)->version(Request::create('/')),
            'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
            'HTTP_ACCEPT' => 'text/html, application/xhtml+xml',
        ];

        if ($component) {
            $server['HTTP_X_INERTIA_PARTIAL_COMPONENT'] = $component;
            $server['HTTP_X_INERTIA_PARTIAL_DATA'] = $only;
        }

        $request = Request::create($path, 'GET', server: $server);
        $request->setLaravelSession($session = app('session')->driver());
        $session->start();
        auth()->guard('web')->setUser($user);

        $response = $kernel->handle($request);
        $json = json_decode($response->getContent(), true);

        if (! is_array($json)) {
            $exception = $response->exception ?? null;

            return $response->getStatusCode().' '.($exception ? get_class($exception).': '.$exception->getMessage().' @ '.$exception->getFile().':'.$exception->getLine() : substr(strip_tags($response->getContent()), 0, 2000));
        }

        return $json;
    }
}
