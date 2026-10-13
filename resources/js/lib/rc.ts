import { router } from '@inertiajs/react';

/** URL for a page inside an environment, e.g. envUrl(env.id, 'requests'). */
export function envUrl(environmentId: string, path = '', query?: Record<string, string | number | null | undefined>): string {
    const base = `/environments/${environmentId}${path ? `/${path.replace(/^\//, '')}` : ''}`;

    return query ? `${base}${toQueryString(query)}` : base;
}

export function currentQuery(): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(window.location.search).entries());
}

export function toQueryString(query: Record<string, string | number | null | undefined>): string {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            params.set(key, String(value));
        }
    });

    const string = params.toString();

    return string ? `?${string}` : '';
}

/**
 * Merge params into the current query string and visit the same page.
 * Pass null to remove a param. Resets pagination unless `page`/`cursor` is set.
 */
export function visitWithQuery(params: Record<string, string | number | null | undefined>, options: { preserveScroll?: boolean; only?: string[] } = {}): void {
    const query: Record<string, string | number | null | undefined> = { ...currentQuery() };

    if (!('page' in params)) delete query.page;
    if (!('cursor' in params)) delete query.cursor;

    Object.assign(query, params);

    router.get(window.location.pathname + toQueryString(query), {}, {
        preserveState: true,
        preserveScroll: options.preserveScroll ?? true,
        only: options.only,
    });
}

/** Keep the period/user filter when linking from one page to another. */
export function withPeriod(url: string): string {
    const query = currentQuery();
    const keep: Record<string, string> = {};

    ['period', 'from', 'to', 'user'].forEach((key) => {
        if (query[key]) keep[key] = query[key];
    });

    const [path, existing] = url.split('?');
    const merged = { ...Object.fromEntries(new URLSearchParams(existing ?? '').entries()), ...keep };

    return path + toQueryString(merged);
}

export function can(permissions: string[], permission: string): boolean {
    return permissions.includes(permission);
}
