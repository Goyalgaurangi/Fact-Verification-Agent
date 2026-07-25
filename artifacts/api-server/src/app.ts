import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Temporary: disable pino-http to test Vercel build
// app.use(pinoHttp({ logger }));

app.use(cors());
// Increase body limit for base64 image uploads (up to ~10MB)
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

export default app;
