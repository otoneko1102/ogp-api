import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { fetchOGData } from "./og.js";

const app = new Hono();

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return c.text("", 200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
  }
  await next();
  c.header("Access-Control-Allow-Origin", "*");
});

app.get("/", async (c) => {
  const reqUrl = new URL(
    c.req.url || "/",
    `http://${c.req.header("host") || "localhost"}`,
  );
  const target = reqUrl.searchParams.get("url");

  if (!target) {
    return c.json({ error: "Missing `url` query parameter" }, 400);
  }

  try {
    const data = await fetchOGData(target);
    if (!data) return c.json({ error: "Invalid url" }, 400);

    return c.json(data, 200, {
      "Cache-Control": "public, max-age=1800",
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: "Failed to fetch OGP" }, 500);
  }
});

serve(
  {
    fetch: app.fetch,
    port: 3090,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
