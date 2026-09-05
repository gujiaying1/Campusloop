# CampusLoop

CampusLoop is a bilingual (English / Simplified Chinese) full-stack marketplace for university students to list, discover, and manage second-hand items. It explores complete marketplace workflows across a React frontend, a REST API, and a relational database.

## Overview

The project focuses on the parts of a marketplace that require more than displaying listings: authenticated accounts, ownership checks, saved items, buyer-seller communication, reservations, reporting, and role-based moderation.

## Core Features

- Account registration, login, session restoration, and logout.
- Authenticated listing creation, editing, and deletion, with server-enforced ownership.
- Public marketplace browsing with keyword, category, condition, price filtering, and newest/price sorting handled by the API.
- Per-user favourites that can be added and removed without affecting other users.
- One buyer-seller conversation per listing, with participant-only message access.
- Reservation requests, seller acceptance/decline, buyer cancellation, and a sold state.
- Listing reports with a required reason and a pending/dismissed/resolved moderation workflow.
- Administrator-only report review and soft removal of listings from normal marketplace views.
- A persisted English / Simplified Chinese toggle for the primary marketplace workflows. User-created listing content remains in its original language.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, and the browser Fetch API
- **Backend:** Node.js, Express, and TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** bcrypt password hashing and signed JWTs in HttpOnly cookies
- **API:** REST-style JSON endpoints
- **Testing:** Vitest and Supertest integration tests
- **Version control:** Git

## Engineering Highlights

- Authentication identifies the signed-in user; backend ownership checks decide who may edit or delete a listing.
- Sensitive workflows are database-backed rather than maintained only in browser state.
- Messaging routes verify that the requester is a conversation participant before exposing or accepting messages.
- Reservation acceptance uses a Prisma transaction to accept one request, reserve the listing, and decline competing pending requests together.
- Admin moderation uses role-based access control and soft removal, preserving the data relationship while excluding removed listings from browse, search, favourites, new conversations, and new reservations.

## AI-Assisted Development

Codex was used during development to inspect the existing codebase, support implementation and debugging, and review proposed changes. Suggested changes were checked against the application behaviour and automated tests before being integrated.

## Project Structure

```text
client/                 React + Vite application
  src/                  UI components and styles
server/                 Express API
  src/                  routes, authentication middleware, and tests
  prisma/               Prisma schema, migrations, and seed script
```

## Running Locally

### Prerequisites

- Node.js and npm
- A local PostgreSQL instance

### Setup

Install the client and server dependencies separately:

```sh
cd client && npm install
cd ../server && npm install
```

Create a local environment file from the example, then set a PostgreSQL connection string and a strong JWT secret. Do not commit this file.

```sh
cd server
cp .env.example .env
```

Apply the checked-in Prisma migrations and seed the demo listings:

```sh
cd server
npx prisma migrate dev
npm run db:seed
```

Run the API in one terminal:

```sh
cd server
npm run dev
```

Run the frontend in another terminal:

```sh
cd client
npm run dev
```

The Vite development server proxies `/api` requests to `http://localhost:3001`.

### Checks

```sh
cd server && npm test
cd server && npm run build
cd client && npm run build
```

## Architecture

```text
React + TypeScript frontend
          ↓ REST JSON API
Express + TypeScript backend
          ↓ Prisma ORM
       PostgreSQL
```

## Testing

`server/src/app.test.ts` contains 13 Vitest/Supertest integration tests against the local development database. They cover health, seeded listing reads, backend search/filter/sort validation, authentication, listing CRUD ownership, favourites, conversation membership, reservation transitions, and reporting/admin soft moderation.

The listings tests assume `npm run db:seed` has populated the local PostgreSQL database with the documented demo listings.

## Screenshots

Screenshots are not committed yet. Before sharing the repository, capture these real application states and add them under `docs/screenshots/` only after the image files exist:

1. `marketplace-search.png` — signed out or signed in; show several listings and an applied search/filter.
2. `listing-create-edit.png` — signed in as the listing owner; show the create or edit form with non-sensitive sample data.
3. `messaging.png` — signed in as a buyer or seller; show a conversation with harmless sample messages.
4. `reservation.png` — show a pending or accepted reservation and its listing status.
5. `admin-moderation.png` — signed in as an administrator; show a pending report in the moderation panel. Do not include real personal information.

## Current Status

Core marketplace functionality is implemented through reporting and administrative moderation, including API search/sort, a bilingual primary UI, and integration coverage for the main workflows. Production deployment and broader browser-level QA remain future work.

## What I Learned / Engineering Decisions

- Authentication and authorisation are separate: a valid session does not by itself grant ownership or administrator privileges.
- Relational constraints support product rules such as one favourite per user/listing and one buyer conversation per listing.
- Transactions matter when several records must change together, as in accepting a reservation.
- Soft moderation can remove content from normal user flows without unnecessarily deleting associated records.
- Localisation is kept in one frontend translation dictionary, so labels can be maintained without duplicating pages or user-generated content.
