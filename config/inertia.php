<?php

// Pages live in resources/js/pages (lowercase). Inertia defaults to
// js/Pages, which only works on case-insensitive file systems like macOS.

return [

    'page_paths' => [
        resource_path('js/pages'),
    ],

    'page_extensions' => ['tsx', 'ts'],

    'testing' => [
        'ensure_pages_exist' => true,
        'page_paths' => [
            resource_path('js/pages'),
        ],
        'page_extensions' => ['tsx', 'ts'],
    ],

];
