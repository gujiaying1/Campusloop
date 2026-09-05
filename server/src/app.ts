import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { clearAuthCookie, requireAdmin, requireAuth, setAuthCookie } from "./auth.js";
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

const priceQuerySchema = z.string()
  .regex(/^\d+$/, "Price filters must be non-negative integer cents.")
  .transform(Number)
  .optional();

const listingsQuerySchema = z.object({
  search: z.string().optional().transform((value) => value?.trim() || undefined),
  category: z.enum(["ELECTRONICS", "FURNITURE", "TEXTBOOKS", "CLOTHING", "HOME_LIVING", "OTHER"]).optional(),
  condition: z.enum(["LIKE_NEW", "GOOD", "FAIR"]).optional(),
  minPrice: priceQuerySchema,
  maxPrice: priceQuerySchema,
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional()
});

const listingSelect = {
  id: true, title: true, description: true, priceCents: true, category: true,
  condition: true, location: true, status: true, createdAt: true,
  seller: { select: { id: true, name: true } }
} satisfies Prisma.ListingSelect;

const safeUserSelect = { id: true, name: true, email: true } satisfies Prisma.UserSelect;
const messageSchema = z.object({ content: z.string().trim().min(1, "Message cannot be blank.").max(1000, "Message is too long.") });
const reportSchema = z.object({ reason: z.string().trim().min(1, "Report reason is required.").max(500, "Report reason is too long.") });
const conversationSelect = {
  id: true, buyerId: true, sellerId: true, createdAt: true, updatedAt: true,
  listing: { select: listingSelect }, buyer: { select: safeUserSelect }, seller: { select: safeUserSelect }
} satisfies Prisma.ConversationSelect;

function isParticipant(conversation: { buyerId: number; sellerId: number }, userId: number) {
  return conversation.buyerId === userId || conversation.sellerId === userId;
}
const reservationSelect = { id: true, status: true, createdAt: true, updatedAt: true, listing: { select: listingSelect }, buyer: { select: safeUserSelect } } satisfies Prisma.ReservationSelect;

function listingId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const parsed = z.coerce.number().int().positive().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function publicUser(user: { id: number; name: string; email: string; createdAt: Date; role: "USER" | "ADMIN" }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.get("/api/listings", async (request, response, next) => {
  const parsed = listingsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid listing filters." });
    return;
  }
  const { search, category, condition, minPrice, maxPrice, sort = "newest" } = parsed.data;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    response.status(400).json({ error: "Minimum price cannot exceed maximum price." });
    return;
  }

  const where: Prisma.ListingWhereInput = {
    moderationStatus: "ACTIVE",
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(category ? { category } : {}),
    ...(condition ? { condition } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { priceCents: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
      : {})
  };

  try {
    const listings = await prisma.listing.findMany({
      where,
      orderBy: sort === "price_asc" ? { priceCents: "asc" } : sort === "price_desc" ? { priceCents: "desc" } : { createdAt: "desc" },
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
    const listing = await prisma.listing.findFirst({ where: { id, moderationStatus: "ACTIVE" }, select: listingSelect });
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

app.post("/api/listings/:id/favourite", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id);
  if (!id) {
    response.status(400).json({ error: "Listing id must be a positive integer." });
    return;
  }

  try {
    const listing = await prisma.listing.findFirst({ where: { id, moderationStatus: "ACTIVE" }, select: { id: true } });
    if (!listing) {
      response.status(404).json({ error: "Listing not found." });
      return;
    }
    await prisma.favourite.upsert({
      where: { userId_listingId: { userId: request.auth!.userId, listingId: id } },
      update: {},
      create: { userId: request.auth!.userId, listingId: id }
    });
    response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/listings/:id/favourite", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id);
  if (!id) {
    response.status(400).json({ error: "Listing id must be a positive integer." });
    return;
  }

  try {
    await prisma.favourite.deleteMany({ where: { userId: request.auth!.userId, listingId: id } });
    response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/favourites", requireAuth, async (request, response, next) => {
  try {
    const favourites = await prisma.favourite.findMany({
      where: { userId: request.auth!.userId, listing: { moderationStatus: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      select: { listing: { select: listingSelect } }
    });
    response.json(favourites.map((favourite) => favourite.listing));
  } catch (error) {
    next(error);
  }
});

app.post("/api/listings/:id/conversations", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id);
  if (!id) return response.status(400).json({ error: "Listing id must be a positive integer." });
  try {
    const listing = await prisma.listing.findFirst({ where: { id, moderationStatus: "ACTIVE" }, select: { id: true, sellerId: true } });
    if (!listing) return response.status(404).json({ error: "Listing not found." });
    if (listing.sellerId === request.auth!.userId) return response.status(400).json({ error: "You cannot message yourself about your own listing." });
    const conversation = await prisma.conversation.upsert({
      where: { listingId_buyerId: { listingId: id, buyerId: request.auth!.userId } },
      update: {},
      create: { listingId: id, buyerId: request.auth!.userId, sellerId: listing.sellerId },
      select: conversationSelect
    });
    response.json(conversation);
  } catch (error) { next(error); }
});

app.get("/api/conversations", requireAuth, async (request, response, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ buyerId: request.auth!.userId }, { sellerId: request.auth!.userId }] },
      orderBy: { updatedAt: "desc" }, select: conversationSelect
    });
    response.json(conversations);
  } catch (error) { next(error); }
});

app.get("/api/conversations/:id/messages", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id);
  if (!id) return response.status(400).json({ error: "Conversation id must be a positive integer." });
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) return response.status(404).json({ error: "Conversation not found." });
    if (!isParticipant(conversation, request.auth!.userId)) return response.status(403).json({ error: "You are not a participant in this conversation." });
    const messages = await prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" }, select: { id: true, content: true, createdAt: true, sender: { select: safeUserSelect } } });
    response.json(messages);
  } catch (error) { next(error); }
});

app.post("/api/conversations/:id/messages", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id);
  if (!id) return response.status(400).json({ error: "Conversation id must be a positive integer." });
  const parsed = messageSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid message." });
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) return response.status(404).json({ error: "Conversation not found." });
    if (!isParticipant(conversation, request.auth!.userId)) return response.status(403).json({ error: "You are not a participant in this conversation." });
    const message = await prisma.message.create({ data: { conversationId: id, senderId: request.auth!.userId, content: parsed.data.content }, select: { id: true, content: true, createdAt: true, sender: { select: safeUserSelect } } });
    response.status(201).json(message);
  } catch (error) { next(error); }
});

app.post("/api/listings/:id/reservations", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id);
  if (!id) return response.status(400).json({ error: "Listing id must be a positive integer." });
  try {
    const listing = await prisma.listing.findFirst({ where: { id, moderationStatus: "ACTIVE" }, select: { id: true, sellerId: true, status: true } });
    if (!listing) return response.status(404).json({ error: "Listing not found." });
    if (listing.sellerId === request.auth!.userId) return response.status(400).json({ error: "You cannot reserve your own listing." });
    if (listing.status !== "AVAILABLE") return response.status(409).json({ error: "This listing is not available for reservation." });
    const existing = await prisma.reservation.findFirst({ where: { listingId: id, buyerId: request.auth!.userId, status: "PENDING" }, select: reservationSelect });
    if (existing) return response.json(existing);
    const reservation = await prisma.reservation.create({ data: { listingId: id, buyerId: request.auth!.userId }, select: reservationSelect });
    response.status(201).json(reservation);
  } catch (error) { next(error); }
});

app.get("/api/reservations", requireAuth, async (request, response, next) => {
  try {
    const reservations = await prisma.reservation.findMany({ where: { OR: [{ buyerId: request.auth!.userId }, { listing: { sellerId: request.auth!.userId } }] }, orderBy: { createdAt: "desc" }, select: reservationSelect });
    response.json(reservations);
  } catch (error) { next(error); }
});

app.post("/api/reservations/:id/accept", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id); if (!id) return response.status(400).json({ error: "Reservation id must be a positive integer." });
  try {
    const reservation = await prisma.reservation.findUnique({ where: { id }, include: { listing: true } });
    if (!reservation) return response.status(404).json({ error: "Reservation not found." });
    if (reservation.listing.sellerId !== request.auth!.userId) return response.status(403).json({ error: "Only the seller can accept reservations." });
    if (reservation.status !== "PENDING" || reservation.listing.status !== "AVAILABLE") return response.status(409).json({ error: "This reservation cannot be accepted." });
    await prisma.$transaction([
      prisma.reservation.update({ where: { id }, data: { status: "ACCEPTED" } }),
      prisma.listing.update({ where: { id: reservation.listingId }, data: { status: "RESERVED" } }),
      prisma.reservation.updateMany({ where: { listingId: reservation.listingId, status: "PENDING", id: { not: id } }, data: { status: "DECLINED" } })
    ]);
    response.json(await prisma.reservation.findUniqueOrThrow({ where: { id }, select: reservationSelect }));
  } catch (error) { next(error); }
});

app.post("/api/reservations/:id/decline", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id); if (!id) return response.status(400).json({ error: "Reservation id must be a positive integer." });
  try {
    const reservation = await prisma.reservation.findUnique({ where: { id }, include: { listing: true } });
    if (!reservation) return response.status(404).json({ error: "Reservation not found." });
    if (reservation.listing.sellerId !== request.auth!.userId) return response.status(403).json({ error: "Only the seller can decline reservations." });
    if (reservation.status !== "PENDING") return response.status(409).json({ error: "This reservation cannot be declined." });
    response.json(await prisma.reservation.update({ where: { id }, data: { status: "DECLINED" }, select: reservationSelect }));
  } catch (error) { next(error); }
});

app.post("/api/reservations/:id/cancel", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id); if (!id) return response.status(400).json({ error: "Reservation id must be a positive integer." });
  try {
    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation) return response.status(404).json({ error: "Reservation not found." });
    if (reservation.buyerId !== request.auth!.userId) return response.status(403).json({ error: "Only the buyer can cancel this reservation." });
    if (reservation.status !== "PENDING") return response.status(409).json({ error: "This reservation cannot be cancelled." });
    response.json(await prisma.reservation.update({ where: { id }, data: { status: "CANCELLED" }, select: reservationSelect }));
  } catch (error) { next(error); }
});

app.post("/api/listings/:id/sold", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id); if (!id) return response.status(400).json({ error: "Listing id must be a positive integer." });
  try {
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return response.status(404).json({ error: "Listing not found." });
    if (listing.sellerId !== request.auth!.userId) return response.status(403).json({ error: "Only the seller can mark this listing sold." });
    if (listing.status !== "RESERVED") return response.status(409).json({ error: "Only reserved listings can be marked sold." });
    response.json(await prisma.listing.update({ where: { id }, data: { status: "SOLD" }, select: listingSelect }));
  } catch (error) { next(error); }
});

app.post("/api/listings/:id/reports", requireAuth, async (request, response, next) => {
  const id = listingId(request.params.id); if (!id) return response.status(400).json({ error: "Listing id must be a positive integer." });
  const parsed = reportSchema.safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid report." });
  try {
    const listing = await prisma.listing.findFirst({ where: { id, moderationStatus: "ACTIVE" }, select: { id: true } });
    if (!listing) return response.status(404).json({ error: "Listing not found." });
    const existing = await prisma.report.findFirst({ where: { listingId: id, reporterId: request.auth!.userId, status: "PENDING" } });
    if (existing) return response.json(existing);
    response.status(201).json(await prisma.report.create({ data: { listingId: id, reporterId: request.auth!.userId, reason: parsed.data.reason } }));
  } catch (error) { next(error); }
});

const reportSelect = { id: true, reason: true, status: true, createdAt: true, updatedAt: true, reporter: { select: safeUserSelect }, listing: { select: listingSelect } } satisfies Prisma.ReportSelect;
app.get("/api/admin/reports", requireAuth, requireAdmin, async (_request, response, next) => {
  try { response.json(await prisma.report.findMany({ orderBy: { createdAt: "desc" }, select: reportSelect })); } catch (error) { next(error); }
});
app.post("/api/admin/reports/:id/dismiss", requireAuth, requireAdmin, async (request, response, next) => {
  const id = listingId(request.params.id); if (!id) return response.status(400).json({ error: "Report id must be a positive integer." });
  try { const report = await prisma.report.findUnique({ where: { id } }); if (!report) return response.status(404).json({ error: "Report not found." }); if (report.status !== "PENDING") return response.status(409).json({ error: "Report is not pending." }); response.json(await prisma.report.update({ where: { id }, data: { status: "DISMISSED" }, select: reportSelect })); } catch (error) { next(error); }
});
app.post("/api/admin/reports/:id/remove-listing", requireAuth, requireAdmin, async (request, response, next) => {
  const id = listingId(request.params.id); if (!id) return response.status(400).json({ error: "Report id must be a positive integer." });
  try { const report = await prisma.report.findUnique({ where: { id } }); if (!report) return response.status(404).json({ error: "Report not found." }); if (report.status !== "PENDING") return response.status(409).json({ error: "Report is not pending." }); await prisma.$transaction([prisma.report.update({ where: { id }, data: { status: "RESOLVED" } }), prisma.listing.update({ where: { id: report.listingId }, data: { moderationStatus: "REMOVED" } })]); response.json(await prisma.report.findUniqueOrThrow({ where: { id }, select: reportSelect })); } catch (error) { next(error); }
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
