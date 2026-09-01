import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./app.js";

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
