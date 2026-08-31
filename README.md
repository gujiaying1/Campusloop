# CampusLoop

CampusLoop is intended to become a bilingual second-hand marketplace for Massey University students. This repository currently contains only the initial full-stack foundation; authentication, listings, messaging, reservations, reporting, moderation, and all other marketplace features are still future work.

## Implemented so far

- React frontend that checks the backend health endpoint on load.
- Express API with `GET /api/health`, returning `{ "status": "ok" }`.
- Vite proxy for `/api` requests to the backend at port 3001.
- Vitest and Supertest coverage for the health endpoint.

## Stack and structure

- `client/`: React, TypeScript, Vite, and native `fetch`.
- `server/`: Node.js, Express, and TypeScript.
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

The frontend uses `fetch("/api/health")`; Vite forwards this request to `http://localhost:3001` during development.

Build either project with `npm run build` from its folder. Run the backend automated test with `cd server && npm test`.
