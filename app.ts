import { Hono } from "https://deno.land/x/hono@v3.11.6/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v3.11.6/middleware.ts";

import { streamSSE } from "https://deno.land/x/hono@v3.11.6/helper/streaming/index.ts";

const db = await Deno.openKv();
const app = new Hono();
let i = 0;

interface LastVisit {
  country: string;
  city: string;
  flag: string;
}

app.get("/", serveStatic({ path: "index.html" }));

app.post("/visit", async (c) => {
  const { country, city, flag } = await c.req.json<LastVisit>();
  await db
    .atomic()
    .set(["lastVisit"], {
      country,
      city,
      flag,
    })
    .sum(["visits"], 1n)
    .commit();
  return c.json({ message: "ok" });
});

app.get("/visit", (c) => {
  return streamSSE(c, async (stream) => {
    const watcher = db.watch([["lastVisit"]]);

    for await (const entry of watcher) {
      const { value } = entry[0];
      if (value !== null) {
        await stream.writeSSE({
          data: JSON.stringify(value),
          event: "update",
          id: String(i++),
        });
      }
    }
  });
});

Deno.serve(app.fetch);
