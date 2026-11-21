import "dotenv/config";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createScheduledCallback } from "../scheduled-work";
import { scheduledWorkAdapters } from "../scheduled-work-adapters";
import { getRequestBodyLimits } from "./request-limits";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { productionConfigIssues } from "./runtime-config";

async function startServer() {
  const configIssues = productionConfigIssues(process.env);
  if (configIssues.length)
    throw new Error(
      `Invalid production environment. Configure: ${configIssues.join(", ")}`
    );
  const app = express();
  app.disable("x-powered-by");
  const server = createServer(app);
  const bodyLimits = getRequestBodyLimits(process.env);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(self), geolocation=()"
    );
    next();
  });
  app.use(express.json({ limit: bodyLimits.json }));
  app.use(
    express.urlencoded({
      limit: bodyLimits.urlencoded,
      extended: true,
      parameterLimit: 500,
    })
  );
  app.post(
    "/api/scheduled/callback",
    createScheduledCallback(scheduledWorkAdapters)
  );
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/app-config", (_req, res) => {
    res.set("Cache-Control", "no-store").json({
      configured: Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
      ),
      supabaseUrl: process.env.SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
    });
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  const parserErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    const type = (error as { type?: unknown } | null)?.type;
    if (type === "entity.too.large") {
      res
        .status(413)
        .json({ error: "Request body exceeds the configured size limit." });
      return;
    }
    if (type === "entity.parse.failed") {
      res
        .status(400)
        .json({ error: "Request body is not valid JSON or form data." });
      return;
    }
    next(error);
  };
  app.use(parserErrorHandler);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on port ${port}`);
    console.log(`➜ Local: http://localhost:${port}/`);
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
