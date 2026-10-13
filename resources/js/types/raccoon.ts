// Shapes shared by every environment page. They match the props controllers send.

export interface EnvironmentSummary {
    id: string;
    name: string;
    application_id: string;
    color: string;
}

export interface ApplicationSummary {
    id: string;
    name: string;
    avatar_url: string | null;
    environments: EnvironmentSummary[];
}

export interface OrganizationSummary {
    id: string;
    name: string;
    avatar_url: string | null;
    role: 'owner' | 'admin' | 'member';
    applications: ApplicationSummary[];
}

export interface AuthProps {
    user: {
        id: number;
        name: string;
        email: string;
        avatar_url: string | null;
        organizations: OrganizationSummary[];
    } | null;
    permissions: string[];
    org: { id: string; name: string; avatar_url: string | null; lookback_period: number } | null;
    app: { id: string; name: string; avatar_url: string | null } | null;
    env: { id: string; application_id: string; name: string; color: string; issues: { open: number } } | null;
}

export interface PageProps {
    auth: AuthProps;
    name: string;
    flash: { success: string | null; error: string | null };
    errors: Record<string, string>;
    [key: string]: unknown;
}

/** Period props every period-scoped page receives. */
export interface PeriodProps {
    period: string;
    from: string;
    to: string;
}

export interface PaginatorLink {
    url: string | null;
    label: string;
    page?: number | null;
    active: boolean;
}

/** Laravel LengthAwarePaginator::toArray(). */
export interface Paginator<T> {
    current_page: number;
    data: T[];
    from: number | null;
    to: number | null;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginatorLink[];
    next_page_url: string | null;
    prev_page_url: string | null;
    path: string;
}

/** Cursor paginator for timestamp-ordered event lists. */
export interface CursorPaginator<T> {
    data: T[];
    path: string;
    per_page: number;
    next_cursor: string | null;
    next_page_url: string | null;
    prev_cursor: string | null;
    prev_page_url: string | null;
}

/** Durations are microseconds throughout. */
export interface DurationStats {
    min: number | null;
    max: number | null;
    avg: number | null;
    p95: number | null;
}

export interface Deployment {
    deploy: string;
    ref: string | null;
    name: string | null;
    url: string | null;
    timestamp: string;
}

export interface DeploymentBucket {
    bucket: string;
    deployments: Deployment[];
}

export interface GraphPoint {
    bucket: string;
    [key: string]: number | string | null;
}

export interface AppUser {
    id: string;
    name: string | null;
    username: string | null;
}

export type SpanType = 'query' | 'cache_event' | 'outgoing_request' | 'mail' | 'notification' | 'queued_job' | 'exception';

export interface Span {
    group: string;
    span_type: SpanType;
    timestamp: string;
    duration: number;
    offset: number;
    file: string;
    line: number;
    name: string;
    description: string;
    connection: string;
    connection_type: string;
    queue: string;
    extra: string;
}

export interface Stage {
    id: string;
    name: string;
    description: string;
    duration: number;
    offset: number;
    spans: Span[];
}

export interface Execution {
    id: string;
    name: 'request' | 'command' | 'job' | 'scheduled_task';
    description: string;
    status: number | string;
    duration: number;
    offset: number;
    timestamp: string;
    variant: 'success' | 'warning' | 'danger' | 'default';
    link?: { group: string; job_id: string; attempt_id: string };
    stages: Stage[];
}

export type EventSummary = Record<'queries' | 'mail' | 'notifications' | 'outgoing_requests' | 'queued_jobs' | 'cache_events', { count: number; duration: number }>;

export interface ExceptionRow {
    timestamp: string;
    group: string;
    class: string;
    message: string;
    file: string;
    line: number;
    handled: boolean;
    code: string;
}

export interface LogRow {
    timestamp: string;
    level: string;
    message: string;
    context: string;
    extra: string;
}

export interface IssueLink {
    ref: number;
    status: string;
    title: string;
    group?: string;
}
