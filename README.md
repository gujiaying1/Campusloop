# CampusLoop

CampusLoop is intended to become a bilingual second-hand marketplace for Massey University students. This repository currently contains an initial listings vertical slice; authentication, listing creation, messaging, reservations, reporting, moderation, and other marketplace features are still future work.

## Implemented so far

- React frontend that loads listings from the API on page load.
- Express API with `GET /api/health`, returning `{ "status": "ok" }`, and `GET /api/listings`.
- PostgreSQL and Prisma with User and Listing models plus repeatable demo seed data.
- Register, login, current-user, and logout authentication backed by bcrypt password hashes and an HttpOnly JWT cookie.
- Authenticated listing creation, updates, and deletion. Public listing reads remain available to everyone.
- Listing ownership is enforced by the backend: authentication identifies a user, then only that user may change or delete listings they own.
- Vite proxy for `/api` requests to the backend at port 3001.
- Vitest and Supertest coverage for the health endpoint.

## Stack and structure

- `client/`: React, TypeScript, Vite, and native `fetch`.
- `server/`: Node.js, Express, TypeScript, Prisma, and PostgreSQL.
- `server/prisma/`: Prisma schema and seed script.
- `server/src/app.test.ts`: Vitest/Supertest API test.

## Setup

Install dependencies separately:

```sh
cd client && npm install
cd ../server && npm install
```

Run the backend in one terminal:

```sh
cd server && npm run dev
```

Run the frontend in another terminal:

```sh
cd client && npm run dev
```

Copy `server/.env.example` to `server/.env` and set a valid local `DATABASE_URL` before running database commands.
Set a strong `JWT_SECRET` in that local `.env` file before running the backend. The existing seeded Demo Student has no password hash, so it remains intentionally non-login-capable while preserving its listings.

Create the schema and seed demo data:

```sh
cd server
npx prisma migrate dev --name init_user_listing
npm run db:seed
```

The frontend uses `fetch("/api/listings")`; Vite forwards this request to `http://localhost:3001` during development.

## Current API

- `GET /api/listings` and `GET /api/listings/:id` are public.
- `POST /api/listings`, `PATCH /api/listings/:id`, and `DELETE /api/listings/:id` require authentication. The server derives a new listing's seller from the signed-in user and returns `403` for attempts to modify another user's listing.

Build either project with `npm run build` from its folder. Run the backend automated test with `cd server && npm test`.
