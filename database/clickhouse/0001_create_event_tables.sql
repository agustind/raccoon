-- One table per agent record type ("t" in the agent payload).
-- Durations are microseconds, exactly as the agent sends them.
-- Every table is keyed by environment first so all dashboard queries prune
-- by environment, then by group (the agent's "_group" hash) and time.

CREATE TABLE IF NOT EXISTS requests
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    user String,
    method LowCardinality(String),
    url String CODEC(ZSTD(3)),
    route_name String,
    route_methods Array(LowCardinality(String)),
    route_domain String,
    route_path String,
    route_action String,
    ip String,
    duration UInt64,
    status_code UInt16,
    request_size UInt64,
    response_size UInt64,
    bootstrap UInt64,
    before_middleware UInt64,
    action UInt64,
    render UInt64,
    after_middleware UInt64,
    sending UInt64,
    terminating UInt64,
    exceptions UInt32,
    logs UInt32,
    queries UInt32,
    lazy_loads UInt32,
    jobs_queued UInt32,
    mail UInt32,
    notifications UInt32,
    outgoing_requests UInt32,
    files_read UInt32,
    files_written UInt32,
    cache_events UInt32,
    hydrated_models UInt32,
    peak_memory_usage UInt64,
    exception_preview String,
    context String CODEC(ZSTD(3)),
    headers String CODEC(ZSTD(3)),
    payload String CODEC(ZSTD(3)),
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_user user TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS commands
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    class String,
    name String,
    command String CODEC(ZSTD(3)),
    exit_code Int32,
    duration UInt64,
    bootstrap UInt64,
    action UInt64,
    terminating UInt64,
    exceptions UInt32,
    logs UInt32,
    queries UInt32,
    lazy_loads UInt32,
    jobs_queued UInt32,
    mail UInt32,
    notifications UInt32,
    outgoing_requests UInt32,
    files_read UInt32,
    files_written UInt32,
    cache_events UInt32,
    hydrated_models UInt32,
    peak_memory_usage UInt64,
    exception_preview String,
    context String CODEC(ZSTD(3)),
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS job_attempts
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    user String,
    job_id String,
    attempt_id String,
    attempt UInt32,
    name String,
    connection LowCardinality(String),
    queue LowCardinality(String),
    status LowCardinality(String),
    duration UInt64,
    exceptions UInt32,
    logs UInt32,
    queries UInt32,
    lazy_loads UInt32,
    jobs_queued UInt32,
    mail UInt32,
    notifications UInt32,
    outgoing_requests UInt32,
    files_read UInt32,
    files_written UInt32,
    cache_events UInt32,
    hydrated_models UInt32,
    peak_memory_usage UInt64,
    exception_preview String,
    context String CODEC(ZSTD(3)),
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_job job_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_attempt attempt_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS scheduled_tasks
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    name String,
    cron String,
    timezone LowCardinality(String),
    repeat_seconds UInt32,
    without_overlapping Bool,
    on_one_server Bool,
    run_in_background Bool,
    even_in_maintenance_mode Bool,
    status LowCardinality(String),
    duration UInt64,
    exceptions UInt32,
    logs UInt32,
    queries UInt32,
    lazy_loads UInt32,
    jobs_queued UInt32,
    mail UInt32,
    notifications UInt32,
    outgoing_requests UInt32,
    files_read UInt32,
    files_written UInt32,
    cache_events UInt32,
    hydrated_models UInt32,
    peak_memory_usage UInt64,
    exception_preview String,
    context String CODEC(ZSTD(3)),
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

-- Child events: everything that happens inside a request, command, job
-- attempt or scheduled task. execution_source + execution_id point at the
-- parent (execution_id is the parent's trace/attempt id).

CREATE TABLE IF NOT EXISTS queries
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    execution_source LowCardinality(String),
    execution_id String,
    execution_preview String,
    execution_stage LowCardinality(String),
    user String,
    sql String CODEC(ZSTD(3)),
    file String,
    line UInt32,
    duration UInt64,
    connection LowCardinality(String),
    connection_type LowCardinality(String),
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_execution execution_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS exceptions
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    execution_source LowCardinality(String),
    execution_id String,
    execution_preview String,
    execution_stage LowCardinality(String),
    user String,
    class String,
    file String,
    line UInt32,
    message String CODEC(ZSTD(3)),
    code String,
    trace String CODEC(ZSTD(3)),
    handled Bool,
    php_version LowCardinality(String),
    laravel_version LowCardinality(String),
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_execution execution_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS logs
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    trace_id String,
    execution_source LowCardinality(String),
    execution_id String,
    execution_preview String,
    execution_stage LowCardinality(String),
    user String,
    level LowCardinality(String),
    message String CODEC(ZSTD(3)),
    context String CODEC(ZSTD(3)),
    extra String CODEC(ZSTD(3)),
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_execution execution_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_message message TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS queued_jobs
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    execution_source LowCardinality(String),
    execution_id String,
    execution_preview String,
    execution_stage LowCardinality(String),
    user String,
    job_id String,
    name String,
    connection LowCardinality(String),
    queue LowCardinality(String),
    duration UInt64,
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_execution execution_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_job job_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS mail
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    execution_source LowCardinality(String),
    execution_id String,
    execution_preview String,
    execution_stage LowCardinality(String),
    user String,
    mailer LowCardinality(String),
    class String,
    subject String,
    to UInt32,
    cc UInt32,
    bcc UInt32,
    attachments UInt32,
    duration UInt64,
    failed Bool,
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_execution execution_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS notifications
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    execution_source LowCardinality(String),
    execution_id String,
    execution_preview String,
    execution_stage LowCardinality(String),
    user String,
    channel LowCardinality(String),
    class String,
    duration UInt64,
    failed Bool,
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_execution execution_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS outgoing_requests
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    execution_source LowCardinality(String),
    execution_id String,
    execution_preview String,
    execution_stage LowCardinality(String),
    user String,
    host String,
    method LowCardinality(String),
    url String CODEC(ZSTD(3)),
    duration UInt64,
    request_size UInt64,
    response_size UInt64,
    status_code UInt16,
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_execution execution_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

CREATE TABLE IF NOT EXISTS cache_events
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    deploy LowCardinality(String),
    server LowCardinality(String),
    group String,
    trace_id String,
    execution_source LowCardinality(String),
    execution_id String,
    execution_preview String,
    execution_stage LowCardinality(String),
    user String,
    store LowCardinality(String),
    key String,
    type LowCardinality(String),
    duration UInt64,
    ttl Int64,
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_execution execution_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (environment_id, group, timestamp)
TTL toDateTime(timestamp) + INTERVAL {retention_days} DAY;

-- Latest known details for each application user id.
CREATE TABLE IF NOT EXISTS users
(
    environment_id UUID,
    timestamp DateTime64(6, 'UTC'),
    id String,
    name String,
    username String
)
ENGINE = ReplacingMergeTree(timestamp)
ORDER BY (environment_id, id);

-- Hourly event counts per environment for the usage page.
CREATE TABLE IF NOT EXISTS ingest_usage
(
    environment_id UUID,
    bucket DateTime('UTC'),
    type LowCardinality(String),
    events UInt64
)
ENGINE = SummingMergeTree(events)
ORDER BY (environment_id, bucket, type)
TTL bucket + INTERVAL 400 DAY;
