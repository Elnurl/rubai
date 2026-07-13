import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Disable Express's automatic ETag generation. We don't want JSON API
// responses (especially /me/state) to be served as 304 Not Modified because
// downstream clients sometimes resolve those as null/empty bodies and end up
// stuck on a loading screen waiting for fresh data they already had.
app.set("etag", false);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
// 8mb is enough for a typical phone photo at quality 0.6 transmitted as
// base64 in /atlas/coach. The coach handler enforces a stricter per-image
// cap on the actual decoded bytes.
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
