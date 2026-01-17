import { auth } from "@gifview-monorepo/auth";
import { env } from "@gifview-monorepo/env/server";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type Express } from "express";
import routes from "./routes";
import { notFound, errorHandler } from "./middlewares/errorMiddleware";

const app: Express = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());

app.all("/api/auth{/*path}", toNodeHandler(auth));

app.use("/api/v1", routes);

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use(notFound);
app.use(errorHandler);

export default app;
