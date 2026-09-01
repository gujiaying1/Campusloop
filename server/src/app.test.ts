import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "./app.js";
import prisma from "./prisma.js";

const testEmail = `auth-test-${Date.now()}@massey.ac.nz`;
const ownerEmail = `listing-owner-${Date.now()}@massey.ac.nz`;
const otherEmail = `listing-other-${Date.now()}@massey.ac.nz`;
const testPassword = "secure-password-123";
const testEmails = [testEmail, ownerEmail, otherEmail];

afterAll(async () => {
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
