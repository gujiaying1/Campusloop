import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "./app.js";
import prisma from "./prisma.js";

const testEmail = `auth-test-${Date.now()}@massey.ac.nz`;
const ownerEmail = `listing-owner-${Date.now()}@massey.ac.nz`;
const otherEmail = `listing-other-${Date.now()}@massey.ac.nz`;
const favouriteEmail = `favourite-user-${Date.now()}@massey.ac.nz`;
const secondFavouriteEmail = `favourite-second-${Date.now()}@massey.ac.nz`;
const messageSellerEmail = `message-seller-${Date.now()}@massey.ac.nz`;
const messageBuyerEmail = `message-buyer-${Date.now()}@massey.ac.nz`;
const messageThirdEmail = `message-third-${Date.now()}@massey.ac.nz`;
const testPassword = "secure-password-123";
const testEmails = [testEmail, ownerEmail, otherEmail, favouriteEmail, secondFavouriteEmail, messageSellerEmail, messageBuyerEmail, messageThirdEmail];

afterAll(async () => {
  await prisma.message.deleteMany({ where: { sender: { email: { in: testEmails } } } });
  await prisma.conversation.deleteMany({ where: { OR: [{ buyer: { email: { in: testEmails } } }, { seller: { email: { in: testEmails } } }] } });
  await prisma.favourite.deleteMany({ where: { user: { email: { in: testEmails } } } });
  await prisma.listing.deleteMany({ where: { seller: { email: { in: testEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
  await prisma.$disconnect();
});

describe("GET /api/health", () => {
  it("returns the expected health response", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/listings", () => {
  it("returns seeded listings with seller information", async () => {
    // This integration test assumes `npm run db:seed` has populated the local CampusLoop database.
    const response = await request(app).get("/api/listings");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "IKEA Study Desk",
          seller: { id: expect.any(Number), name: "Demo Student" }
        })
      ])
    );
  });

  it("filters listings with valid query parameters", async () => {
    const keyword = await request(app).get("/api/listings?search=desk");
    expect(keyword.status).toBe(200);
    expect(keyword.body).toEqual(expect.arrayContaining([expect.objectContaining({ title: "IKEA Study Desk" })]));

    const category = await request(app).get("/api/listings?category=FURNITURE");
    expect(category.status).toBe(200);
    expect(category.body.every((listing: { category: string }) => listing.category === "FURNITURE")).toBe(true);

    const condition = await request(app).get("/api/listings?condition=LIKE_NEW");
    expect(condition.status).toBe(200);
    expect(condition.body).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Desk Lamp" })]));

    const minimum = await request(app).get("/api/listings?minPrice=3000");
    expect(minimum.status).toBe(200);
    expect(minimum.body.every((listing: { priceCents: number }) => listing.priceCents >= 3000)).toBe(true);

    const maximum = await request(app).get("/api/listings?maxPrice=1600");
    expect(maximum.status).toBe(200);
    expect(maximum.body).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Calculus Textbook" })]));

    const combined = await request(app)
      .get("/api/listings?search=desk&category=FURNITURE&condition=GOOD&minPrice=1000&maxPrice=5000");
    expect(combined.status).toBe(200);
    expect(combined.body).toEqual([expect.objectContaining({ title: "IKEA Study Desk" })]);
  });

  it("returns an empty array for valid filters with no matches", async () => {
    const response = await request(app).get("/api/listings?category=FURNITURE&minPrice=999999999");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("rejects invalid and nonsensical filters", async () => {
    expect((await request(app).get("/api/listings?category=BANANA")).status).toBe(400);
    expect((await request(app).get("/api/listings?condition=DESTROYED")).status).toBe(400);
    expect((await request(app).get("/api/listings?minPrice=abc")).status).toBe(400);
    expect((await request(app).get("/api/listings?minPrice=-100")).status).toBe(400);
    expect((await request(app).get("/api/listings?minPrice=5000&maxPrice=1000")).status).toBe(400);
  });
});

describe("authentication", () => {
  it("rejects registration with a non-Massey email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test Student", email: "student@example.com", password: testPassword });

    expect(response.status).toBe(400);
  });

  it("registers, reads the current user, logs out, and logs back in", async () => {
    const agent = request.agent(app);
    const registration = await agent
      .post("/api/auth/register")
      .send({ name: "Test Student", email: testEmail.toUpperCase(), password: testPassword });

    expect(registration.status).toBe(201);
    expect(registration.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(registration.body.user).toMatchObject({ name: "Test Student", email: testEmail });
    expect(registration.body.user.passwordHash).toBeUndefined();

    const storedUser = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    expect(storedUser.passwordHash).not.toBe(testPassword);

    const currentUser = await agent.get("/api/auth/me");
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.user).toMatchObject({ name: "Test Student", email: testEmail });

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    expect((await agent.get("/api/auth/me")).status).toBe(401);

    const login = await agent.post("/api/auth/login").send({ email: testEmail, password: testPassword });
    expect(login.status).toBe(200);
    expect((await agent.get("/api/auth/me")).status).toBe(200);
  });

  it("rejects login for the seeded non-login Demo Student account", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@massey.ac.nz", password: testPassword });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid email or password." });
  });
});

describe("listing CRUD and ownership", () => {
  const listingInput = {
    title: "Test Study Chair",
    description: "A comfortable chair used only by the CRUD integration test.",
    priceCents: 3500,
    category: "FURNITURE",
    condition: "GOOD",
    location: "Albany Campus"
  };

  async function registerAgent(name: string, email: string) {
    const agent = request.agent(app);
    const response = await agent
      .post("/api/auth/register")
      .send({ name, email, password: testPassword });
    expect(response.status).toBe(201);
    return { agent, userId: response.body.user.id as number };
  }

  it("enforces authenticated CRUD and listing ownership", async () => {
    expect((await request(app).post("/api/listings").send(listingInput)).status).toBe(401);

    const owner = await registerAgent("Listing Owner", ownerEmail);
    const other = await registerAgent("Other Student", otherEmail);

    expect((await owner.agent.post("/api/listings").send({ ...listingInput, priceCents: 1250.5 })).status).toBe(400);

    const created = await owner.agent.post("/api/listings").send({
      ...listingInput,
      sellerId: other.userId,
      status: "SOLD"
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: listingInput.title,
      status: "AVAILABLE",
      seller: { id: owner.userId, name: "Listing Owner" }
    });
    const listingId = created.body.id as number;

    const stored = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(stored.sellerId).toBe(owner.userId);

    const singleListing = await request(app).get(`/api/listings/${listingId}`);
    expect(singleListing.status).toBe(200);
    expect(singleListing.body).toMatchObject({ id: listingId, seller: { id: owner.userId } });
    expect((await request(app).get("/api/listings/999999999")).status).toBe(404);

    expect((await request(app).patch(`/api/listings/${listingId}`).send({ title: "No session" })).status).toBe(401);
    expect((await other.agent.patch(`/api/listings/${listingId}`).send({ title: "Not allowed" })).status).toBe(403);

    const updated = await owner.agent.patch(`/api/listings/${listingId}`).send({
      title: "Updated Test Study Chair",
      priceCents: 4200,
      sellerId: other.userId
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: listingId,
      title: "Updated Test Study Chair",
      priceCents: 4200,
      seller: { id: owner.userId }
    });
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).sellerId).toBe(owner.userId);

    expect((await request(app).delete(`/api/listings/${listingId}`)).status).toBe(401);
    expect((await other.agent.delete(`/api/listings/${listingId}`)).status).toBe(403);
    expect((await owner.agent.delete(`/api/listings/${listingId}`)).status).toBe(204);
    expect((await request(app).get(`/api/listings/${listingId}`)).status).toBe(404);
  });
});

describe("favourites", () => {
  async function registerAgent(name: string, email: string) {
    const agent = request.agent(app);
    const response = await agent
      .post("/api/auth/register")
      .send({ name, email, password: testPassword });
    expect(response.status).toBe(201);
    return agent;
  }

  it("creates independent, idempotent favourites and removes only the current user's favourite", async () => {
    const target = await prisma.listing.findFirstOrThrow({ where: { title: "IKEA Study Desk" } });
    const firstUser = await registerAgent("Favourite Student", favouriteEmail);
    const secondUser = await registerAgent("Second Favourite Student", secondFavouriteEmail);

    expect((await request(app).post(`/api/listings/${target.id}/favourite`)).status).toBe(401);
    expect((await firstUser.get("/api/favourites")).body).toEqual([]);
    expect((await firstUser.post("/api/listings/999999999/favourite")).status).toBe(404);

    const firstFavourite = await firstUser.post(`/api/listings/${target.id}/favourite`);
    expect(firstFavourite.status).toBe(200);
    expect(await prisma.favourite.count({ where: { user: { email: favouriteEmail }, listingId: target.id } })).toBe(1);

    expect((await firstUser.post(`/api/listings/${target.id}/favourite`)).status).toBe(200);
    expect(await prisma.favourite.count({ where: { user: { email: favouriteEmail }, listingId: target.id } })).toBe(1);

    const mine = await firstUser.get("/api/favourites");
    expect(mine.status).toBe(200);
    expect(mine.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: target.id, seller: expect.any(Object) })]));

    expect((await secondUser.post(`/api/listings/${target.id}/favourite`)).status).toBe(200);
    expect((await firstUser.delete(`/api/listings/${target.id}/favourite`)).status).toBe(200);
    expect((await firstUser.get("/api/favourites")).body).toEqual([]);
    expect((await secondUser.get("/api/favourites")).body).toEqual(expect.arrayContaining([expect.objectContaining({ id: target.id })]));
  });
});

describe("messaging", () => {
  async function registerAgent(name: string, email: string) {
    const agent = request.agent(app);
    const response = await agent.post("/api/auth/register").send({ name, email, password: testPassword });
    expect(response.status).toBe(201);
    return { agent, userId: response.body.user.id as number };
  }

  it("creates one participant-only conversation with persisted messages", async () => {
    const seller = await registerAgent("Message Seller", messageSellerEmail);
    const buyer = await registerAgent("Message Buyer", messageBuyerEmail);
    const third = await registerAgent("Message Third", messageThirdEmail);
    const listing = await seller.agent.post("/api/listings").send({ title: "Message Test Item", description: "Test listing for messaging.", priceCents: 1000, category: "OTHER", condition: "GOOD", location: "Albany" });
    expect(listing.status).toBe(201);
    const listingId = listing.body.id as number;

    expect((await request(app).post(`/api/listings/${listingId}/conversations`)).status).toBe(401);
    expect((await buyer.agent.get("/api/conversations")).body).toEqual([]);
    expect((await seller.agent.post(`/api/listings/${listingId}/conversations`)).status).toBe(400);
    expect((await buyer.agent.post("/api/listings/999999999/conversations")).status).toBe(404);

    const created = await buyer.agent.post(`/api/listings/${listingId}/conversations`);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ buyerId: buyer.userId, sellerId: seller.userId });
    const conversationId = created.body.id as number;
    expect((await buyer.agent.post(`/api/listings/${listingId}/conversations`)).body.id).toBe(conversationId);
    expect(await prisma.conversation.count({ where: { listingId, buyerId: buyer.userId } })).toBe(1);

    expect((await buyer.agent.post(`/api/conversations/${conversationId}/messages`).send({ content: "Hi, is this still available?" })).status).toBe(201);
    expect((await seller.agent.post(`/api/conversations/${conversationId}/messages`).send({ content: "Yes, it is." })).status).toBe(201);
    expect((await buyer.agent.post(`/api/conversations/${conversationId}/messages`).send({ content: "   " })).status).toBe(400);
    expect((await third.agent.get(`/api/conversations/${conversationId}/messages`)).status).toBe(403);
    expect((await third.agent.post(`/api/conversations/${conversationId}/messages`).send({ content: "Nope" })).status).toBe(403);
    const messages = await buyer.agent.get(`/api/conversations/${conversationId}/messages`);
    expect(messages.status).toBe(200);
    expect(messages.body.map((message: { content: string }) => message.content)).toEqual(["Hi, is this still available?", "Yes, it is."]);
    expect((await seller.agent.get(`/api/conversations/${conversationId}/messages`)).status).toBe(200);
    expect((await buyer.agent.get("/api/conversations")).body).toEqual(expect.arrayContaining([expect.objectContaining({ id: conversationId })]));
  });
});
