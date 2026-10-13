# ClickHouse for the Railway "clickhouse" service. Mount a volume at
# /var/lib/clickhouse and set CLICKHOUSE_USER / CLICKHOUSE_PASSWORD / CLICKHOUSE_DB.
FROM clickhouse/clickhouse-server:25.8
COPY low-memory.xml /etc/clickhouse-server/config.d/low-memory.xml
COPY listen.xml /etc/clickhouse-server/config.d/listen.xml
COPY profile.xml /etc/clickhouse-server/users.d/profile.xml
