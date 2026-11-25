import "dotenv/config";

import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import express from "express";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Adapter, Database, Resource } from "@adminjs/sql";

AdminJS.registerAdapter({ Database, Resource });

const app = express();
const redisCommanderPort = Number(process.env.REDIS_COMMANDER_PORT) || 8081;

// 127.0.0.1 = this machine only. Use 0.0.0.0 if other machines must reach it.
const redisCommanderHost = process.env.REDIS_COMMANDER_HOST || "127.0.0.1";

const redisCommanderArgs = (redisUrl: string): string[] => {
  const url = new URL(redisUrl);
  const args = [
    "--address", redisCommanderHost,
    "--port", String(redisCommanderPort),
    "--redis-host", url.hostname,
    "--redis-port", url.port || "6379",
    "--nosave",
  ];

  if (url.username) args.push("--redis-username", decodeURIComponent(url.username));
  if (url.password) args.push("--redis-password", decodeURIComponent(url.password));

  const db = url.pathname.replace("/", "");
  if (db) args.push("--redis-db", db);
  if (url.protocol === "rediss:") args.push("--redis-tls");

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    args.push(
      "--http-auth-username", process.env.ADMIN_EMAIL,
      "--http-auth-password", process.env.ADMIN_PASSWORD
    );
  }
  return args;
};

const startRedisCommander = (redisUrl: string): ChildProcess => {
  const require = createRequire(import.meta.url);
  const bin = require.resolve("redis-commander/bin/redis-commander.js");
  const child = spawn(process.execPath, [bin, ...redisCommanderArgs(redisUrl)], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    if (code) console.error(`Redis Commander exited with code ${code}`);
  });
  return child;
};

const waitForPort = (port: number, timeoutMs = 10000): Promise<void> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Redis Commander did not start on port ${port}`));
        } else {
          setTimeout(attempt, 200);
        }
      });
    };
    attempt();
  });

const start = async (): Promise<void> => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is missing.");

  const databaseName =
    process.env.DB_NAME ||
    new URL(databaseUrl.replace(/^postgres:\/\//, "http://")).pathname.replace("/", "");
  if (!databaseName) throw new Error("Add DB_NAME to .env");

  const db = await new Adapter("postgresql", {
    connectionString: databaseUrl,
    database: databaseName,
  }).init();

  const admin = new AdminJS({ rootPath: "/admin", databases: [db] });

  const router = AdminJSExpress.buildAuthenticatedRouter(admin, {
    authenticate: async (email, password) =>
      email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD
        ? { email }
        : null,
    cookieName: "adminjs",
    cookiePassword: process.env.COOKIE_SECRET!,
  });

  app.use(admin.options.rootPath, router);

  const port = Number(process.env.PORT) || 3000;
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const redisCommander = startRedisCommander(redisUrl);

    const stopRedis = () => redisCommander.kill();
    process.on("exit", stopRedis);
    process.on("SIGINT", () => { stopRedis(); process.exit(0); });
    process.on("SIGTERM", () => { stopRedis(); process.exit(0); });

    await waitForPort(redisCommanderPort);
    console.log(`Redis UI: http://localhost:${redisCommanderPort}`);
  } else {
    console.warn("REDIS_URL is missing. Redis UI disabled.");
  }

  app.listen(port, () => {
    console.log(`AdminJS: http://localhost:${port}/admin`);
  });
};

start().catch((error: unknown) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
