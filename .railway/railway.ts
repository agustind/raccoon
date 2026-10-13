// Railway project for Raccoon, as code.
//
//   railway config plan    # preview against the linked project
//   railway config apply   # create or update services
//
// The same project is the source for the one-click Railway template
// (see docs/railway.md). Services run in Virginia (us-east4), next to AWS
// us-east-1 where the monitored app runs.

import { defineRailway, github, group, postgres, preserve, project, service, volume } from "railway/iac";

/** GitHub repository Railway builds from. Change this after you publish the repo. */
const REPOSITORY = "agustind/raccoon";

const REGION = "us-east4-eqdc4a";

export default defineRailway(() => {
  const db = postgres("postgres", { region: REGION });

  const clickhouseData = volume("clickhouse-data", { region: REGION, sizeMB: 10_240 });

  const clickhouse = service("clickhouse", {
    source: github(REPOSITORY, { rootDirectory: "docker/clickhouse" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    regions: { [REGION]: 1 },
    volumeMounts: { "/var/lib/clickhouse": clickhouseData },
    env: {
      CLICKHOUSE_DB: "raccoon",
      CLICKHOUSE_USER: "raccoon",
      // Set once with a random value (`railway variables --service clickhouse
      // --set CLICKHOUSE_PASSWORD=$(openssl rand -hex 24)`); IaC keeps it.
      // In the template it is a generated ${{secret(32)}} variable.
      CLICKHOUSE_PASSWORD: preserve(),
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: "1",
    },
  });

  // Shared by web and worker so both talk to the same databases with the
  // same settings. APP_KEY is generated on first boot and stored in Postgres
  // (docker/app-key.php) unless you set one.
  const app = {
    APP_NAME: "Raccoon",
    APP_ENV: "production",
    APP_DEBUG: "false",
    APP_URL: "https://${{web.RAILWAY_PUBLIC_DOMAIN}}",
    LOG_CHANNEL: "stderr",
    LOG_LEVEL: "warning",
    DB_CONNECTION: "pgsql",
    DB_URL: db.env.DATABASE_URL,
    SESSION_DRIVER: "database",
    CACHE_STORE: "database",
    QUEUE_CONNECTION: "database",
    CLICKHOUSE_URL: "http://${{clickhouse.RAILWAY_PRIVATE_DOMAIN}}:8123",
    CLICKHOUSE_DATABASE: clickhouse.env.CLICKHOUSE_DB,
    CLICKHOUSE_USERNAME: clickhouse.env.CLICKHOUSE_USER,
    CLICKHOUSE_PASSWORD: clickhouse.env.CLICKHOUSE_PASSWORD,
    CLICKHOUSE_RETENTION_DAYS: "30",
    MAIL_MAILER: "log",
  };

  const web = service("web", {
    source: github(REPOSITORY),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    regions: { [REGION]: 1 },
    healthcheck: "/up",
    healthcheckTimeout: 300,
    env: { ...app, ROLE: "web", PORT: "8080" },
  });

  const worker = service("worker", {
    source: github(REPOSITORY),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    regions: { [REGION]: 1 },
    env: { ...app, ROLE: "worker" },
  });

  return project("raccoon", {
    resources: [...group("Raccoon", [web, worker]), ...group("Data", [db, clickhouse, clickhouseData])],
  });
});
