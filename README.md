# Rap Eugene Studio

Day 1, Day 2, and Day 3 foundation for a professional photography and videography studio management platform.

Day 6 adds role-aware staff management, project assignments, and scoped project/client access.

Day 8 adds private project galleries, secure token access, gallery media metadata, and a local development storage adapter.

## Stack

- Plain HTML, CSS, and vanilla JavaScript
- Node.js and Express
- MongoDB with Mongoose

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` for the public website and `http://localhost:3000/admin` for the admin login UI.

Health check: `http://localhost:3000/api/health`

Database test: `http://localhost:3000/api/test/database`

Day 3 API routes:

- `GET|POST /api/services`, `GET|PUT|DELETE /api/services/:id`
- `GET|POST /api/packages`, `GET|PUT|DELETE /api/packages/:id`
- `GET|POST /api/bookings`, `GET|PUT|DELETE /api/bookings/:id`

The public Services page reads active services and packages from these APIs. The public Booking page submits customer requests, creating or updating a client record as part of the request. The admin dashboard includes basic service, package, and booking management controls.

Day 6 routes:

- `GET|POST /api/staff`, `PUT|DELETE /api/staff/:id` (mutations require `superadmin`; listing is available to `superadmin` and `manager`)
- `GET /api/projects`, `GET /api/projects/:id`, `PUT /api/projects/:id/assignments`
- `GET /api/clients` (global for managers/superadmins, assignment-scoped for staff)

Project assignments use role-tagged User references for photographers, videographers, and editors. Historical `assignedStaff` references remain supported.

Day 8 gallery routes:

- `GET|POST /api/galleries`
- `GET|PUT|DELETE /api/galleries/:id`
- `GET /api/galleries/:id/media`
- `POST /api/galleries/:id/media`
- `PUT|DELETE /api/galleries/:id/media/:itemId`
- `POST /api/projects/:id/create-gallery`
- `GET /api/gallery-access/:token`

Day 8 uploads use a local development adapter at `frontend/assets/uploads` and store only URL/storage metadata in MongoDB. Images are limited to 15 MB and videos to 250 MB. For production, mount persistent storage or replace the adapter with Cloudinary, R2, S3, or another object-storage provider without changing the gallery data contract.

Day 9 adds client gallery selection, revision requests, final approval, and secure token-based downloads.

Day 10 adds the client CRM, duplicate-client reuse during booking creation, client history, status management, and role-scoped access.

Copy `.env.example` to `.env` for local development. In production, set `PORT`, `MONGODB_URI`, `JWT_SECRET`, and optionally `FRONTEND_ORIGIN` in the deployment environment. Deployment environment variables take precedence over a local `.env`. `/api/health` returns HTTP 503 when MongoDB is unavailable.

To create the first production administrator, temporarily set `ADMIN_SETUP_SECRET` in Render, then send a `POST` request to `/api/auth/setup-admin` with `Authorization: Bearer <ADMIN_SETUP_SECRET>` and a JSON body containing `name`, `email`, and a strong `password`. The endpoint is one-time: it returns a conflict once a `superadmin` exists. Remove `ADMIN_SETUP_SECRET` after setup.

## Current scope

The public pages, admin interface, authentication, role permissions, booking workflows, client CRM, private galleries, revision and approval workflows, and database-backed CRUD APIs are connected. A legacy `PaymentRecord` model remains dormant for compatibility, but no payment API, payment form, payment dashboard, or payment processing is exposed. Advanced analytics remain future work.
