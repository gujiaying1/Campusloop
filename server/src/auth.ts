import "dotenv/config";
import type { CookieOptions, NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const cookieName = "campusloop_auth";

function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET must be configured.");
  }
  return jwtSecret;
}

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: number };
    }
  }
}

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

export function setAuthCookie(response: Response, userId: number) {
  const token = jwt.sign({ userId }, getJwtSecret(), { expiresIn: "7d" });
  response.cookie(cookieName, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookie(response: Response) {
  response.clearCookie(cookieName, cookieOptions);
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = request.cookies[cookieName] as string | undefined;

  if (!token) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    if (typeof payload.userId !== "number") {
      throw new Error("Invalid authentication token.");
    }
    request.auth = { userId: payload.userId };
    next();
  } catch {
    response.status(401).json({ error: "Authentication required." });
  }
}
