import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { clearAuthCookie, requireAuth, setAuthCookie } from "./auth.js";
import prisma from "./prisma.js";

const app = express();

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().endsWith("@massey.ac.nz", "Use a Massey email address."),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, "Name is required.")
});

const listingInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().min(1, "Description is required."),
  priceCents: z.number().int().positive("Price must be a positive number of cents."),
  category: z.enum(["ELECTRONICS", "FURNITURE", "TEXTBOOKS", "CLOTHING", "HOME_LIVING", "OTHER"]),
  condition: z.enum(["LIKE_NEW", "GOOD", "FAIR"]),
  location: z.string().trim().min(1, "Location is required.")
});

const listingUpdateSchema = listingInputSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Provide at least one listing field to update."
);

const listingSelect = {
  id: true, title: true, description: true, priceCents: true, category: true,
  condition: true, location: true, status: true, createdAt: true,
  seller: { select: { id: true, name: true } }
} satisfies Prisma.ListingSelect;

function listingId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const parsed = z.coerce.number().int().positive().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function publicUser(user: { id: number; name: string; email: string; createdAt: Date }) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.get("/api/listings", async (_request, response, next) => {
  try {
    const listings = await prisma.listing.findMany({
      orderBy: { createdAt: "desc" },
      select: listingSelect
    });
    response.json(listings);
  } catch (error) {
    next(error);
  }
});

app.get("/api/listings/:id", async (request, response, next) => {
  const id = listingId(request.params.id);
  if (!id) {
    response.status(400).json({ error: "Listing id must be a positive integer." });
    return;
  }

  try {
    const listing = await prisma.listing.findUnique({ where: { id }, select: listingSelect });
    if (!listing) {
      response.status(404).json({ error: "Listing not found." });
      return;
    }
    response.json(listing);
  } catch (error) {
    next(error);
  }
});

app.post("/api/listings", requireAuth, async (request, response, next) => {
  const parsed = listingInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid listing details." });
    return;
  }

  try {
    const listing = await prisma.listing.create({
      data: { ...parsed.data, sellerId: request.auth!.userId },
      select: listingSelect
    });
    response.status(201).json(listing);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/listings/:id", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id);
  if (!id) {
    response.status(400).json({ error: "Listing id must be a positive integer." });
    return;
  }
  const parsed = listingUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid listing details." });
    return;
  }

  try {
    const existing = await prisma.listing.findUnique({ where: { id } });
    if (!existing) {
      response.status(404).json({ error: "Listing not found." });
      return;
    }
    if (existing.sellerId !== request.auth!.userId) {
      response.status(403).json({ error: "You can only edit your own listings." });
      return;
    }
    const listing = await prisma.listing.update({ where: { id }, data: parsed.data, select: listingSelect });
    response.json(listing);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/listings/:id", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id);
  if (!id) {
    response.status(400).json({ error: "Listing id must be a positive integer." });
    return;
  }

  try {
    const existing = await prisma.listing.findUnique({ where: { id } });
    if (!existing) {
      response.status(404).json({ error: "Listing not found." });
      return;
    }
    if (existing.sellerId !== request.auth!.userId) {
      response.status(403).json({ error: "You can only delete your own listings." });
      return;
    }
    await prisma.listing.delete({ where: { id } });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/register", async (request, response, next) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid registration details." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash }
    });
    setAuthCookie(response, user.id);
    response.status(201).json({ user: publicUser(user) });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      response.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    next(error);
  }
});

app.post("/api/auth/login", async (request, response, next) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid login details." });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const validPassword = user?.passwordHash
      ? await bcrypt.compare(parsed.data.password, user.passwordHash)
      : false;

    if (!user || !validPassword) {
      response.status(401).json({ error: "Invalid email or password." });
      return;
    }

    setAuthCookie(response, user.id);
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: request.auth!.userId } });
    if (!user) {
      clearAuthCookie(response);
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (_request, response) => {
  clearAuthCookie(response);
  response.json({ status: "ok" });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("Unexpected API error:", error);
  response.status(500).json({ error: "Unable to load listings right now." });
});

export default app;
