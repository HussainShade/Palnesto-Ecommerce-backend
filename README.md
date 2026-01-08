```
npm install
npm run dev
```

```
open http://localhost:5000
```

## CORS Configuration

The backend is configured to accept requests from your Next.js frontend:

- **Default Frontend URL**: `http://localhost:3000`
- **Credentials**: Enabled (required for HTTP-only cookies)
- **Allowed Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization

**Environment Variable:**
```env
FRONTEND_URL=http://localhost:3000
```

Or use the legacy variable:
```env
CORS_ORIGIN=http://localhost:3000
```

If not set, defaults to `http://localhost:3000`.

**Note**: Hono's CORS middleware automatically handles OPTIONS preflight requests.

## Database Setup

### How Mongoose Works (vs Prisma)

**Unlike Prisma, Mongoose does NOT require migrations or schema pushes:**

1. **Collections are created automatically** - When you first save a document, Mongoose automatically creates the collection in MongoDB
2. **Indexes are created automatically** - Indexes defined in your schemas are created when the model is first used
3. **No `npx prisma db push` equivalent** - Just start your server and use the API!

### What Happens on Server Start

When you run `npm run dev`:
- MongoDB connection is established
- Indexes are ensured (created if they don't exist)
- Collections are created automatically when you first insert data

### Optional: Seed Database

If you want to populate the database with test data, you can run:

```bash
npm run seed
```

This will create:
- A test seller account (email: `seller@example.com`, password: `password123`)
- 5 sample shirts with different sizes, types, and prices

**Note:** Seeding is completely optional. You can also create sellers and shirts through the API.
