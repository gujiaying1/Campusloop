import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "./app.js";
import prisma from "./prisma.js";

const testEmail = `auth-test-${Date.now()}@massey.ac.nz`;
const testPassword = "secure-password-123";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
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
