# Mongoose vs Prisma: Key Differences

## TL;DR

**Mongoose (MongoDB):**
- ✅ No migrations needed
- ✅ Collections created automatically
- ✅ Indexes created automatically
- ✅ Just start the server and use it!

**Prisma (PostgreSQL/MySQL/etc.):**
- ⚙️ Requires `npx prisma db push` or migrations
- ⚙️ Requires `npx prisma generate`
- ⚙️ Schema defined in `schema.prisma` file
- ⚙️ More structured workflow

## Detailed Comparison

### 1. Schema Definition

**Prisma:**
```prisma
// schema.prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  name  String
}
```

**Mongoose:**
```typescript
// models/User.ts
const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
});
```

### 2. Database Setup

**Prisma Workflow:**
```bash
# 1. Define schema in schema.prisma
# 2. Push schema to database
npx prisma db push

# 3. Generate Prisma Client
npx prisma generate

# 4. Now you can use Prisma in your code
```

**Mongoose Workflow:**
```bash
# 1. Define schemas in TypeScript files
# 2. Just start your server!
npm run dev

# That's it! Collections and indexes are created automatically
```

### 3. Collection/Table Creation

**Prisma:**
- Tables must be created explicitly via `prisma db push` or migrations
- Schema changes require running migrations
- Database structure is managed separately from code

**Mongoose:**
- Collections are created automatically when you first save a document
- No explicit creation step needed
- Database structure is defined in code and applied automatically

### 4. Indexes

**Prisma:**
- Indexes defined in `schema.prisma`
- Created when you run `prisma db push`
- Must be managed through migrations

**Mongoose:**
- Indexes defined in schema (e.g., `index: true`)
- Created automatically when model is first used
- Our code ensures indexes on connection (see `src/config/database.ts`)

### 5. Seeding

**Prisma:**
```bash
# Define seed script in package.json
# Run with:
npx prisma db seed
```

**Mongoose:**
```bash
# We created a custom seed script
# Run with:
npm run seed
```

Both are optional - you can create data through the API instead.

## What You Need to Do

### For This Project (Mongoose):

1. **Ensure MongoDB is running** (local or remote)
2. **Set `MONGODB_URI` in `.env`** file
3. **Start the server** - that's it!
   ```bash
   npm run dev
   ```

### Optional Steps:

- **Seed test data** (optional):
  ```bash
  npm run seed
  ```

- **Verify in MongoDB Compass:**
  - Connect to your MongoDB instance
  - You'll see collections appear automatically when data is inserted
  - Indexes will be visible in the collection's "Indexes" tab

## When Collections Are Created

Mongoose creates collections lazily:

1. **First API call that saves data** → Collection is created
2. **Example:** `POST /api/auth/login` won't create collections
3. **Example:** `POST /api/shirts` (create shirt) → `shirts` collection created
4. **Example:** `POST /api/auth/login` after creating a seller → `sellers` collection created

## Index Creation

In our setup (`src/config/database.ts`):
- Indexes are ensured on server startup
- This guarantees indexes exist even before first document is saved
- Uses `Model.createIndexes()` which is idempotent (safe to run multiple times)

## Summary

| Feature | Prisma | Mongoose |
|---------|--------|----------|
| Schema Definition | `schema.prisma` file | TypeScript schema files |
| Database Setup | `prisma db push` | Automatic |
| Migrations | Required | Not needed |
| Collections/Tables | Created via push | Created automatically |
| Indexes | Created via push | Created automatically |
| Seeding | `prisma db seed` | `npm run seed` (custom) |
| Type Safety | Generated types | TypeScript interfaces |

**Bottom line:** With Mongoose, you just write your schemas and start using them. No database setup commands needed!

