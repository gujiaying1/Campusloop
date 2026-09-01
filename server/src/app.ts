import express from "express";
import prisma from "./prisma.js";

const app = express();

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.get("/api/listings", async (_request, response, next) => {
  try {
    const listings = await prisma.listing.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, description: true, priceCents: true, category: true,
        condition: true, location: true, status: true, createdAt: true,
        seller: { select: { id: true, name: true } }
      }
    });
    response.json(listings);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("Unexpected API error:", error);
  response.status(500).json({ error: "Unable to load listings right now." });
});

export default app;
