# Backend Architecture Documentation

## Overview

This document explains the architecture, design decisions, and implementation details of the E-commerce Shirt Selling Platform backend.

## Folder Structure

```
/src
  /models        → Mongoose schemas and database models
  /validators    → Zod validation schemas
  /controllers   → Request handlers (thin layer, delegates to services)
  /routes        → Hono route definitions
  /services      → Business logic and external service integrations
  /config        → Database, Redis, and Queue configuration
  /middlewares   → Authentication and error handling middleware
  /utils         → Shared utility functions and types
  index.ts       → Application bootstrap and server setup
```

## Folder Responsibilities

### `/models`
Contains Mongoose schemas that define the data structure and business rules:
- **Seller.ts**: Seller authentication model with password hashing
- **Shirt.ts**: Product model with computed `finalPrice` and indexing strategy

**Key Features:**
- Pre-save hooks for password hashing and price calculation
- Indexes for query optimization
- TypeScript interfaces for type safety

### `/validators`
Zod schemas for request validation:
- **auth.validator.ts**: Login credentials validation
- **shirt.validator.ts**: Shirt CRUD operation validation

**Purpose:**
- Type-safe validation at the API boundary
- Automatic error messages for invalid inputs
- Prevents invalid data from reaching business logic

### `/controllers`
Thin request handlers that:
- Parse and validate request data
- Call service layer methods
- Format responses
- Handle HTTP status codes

**Design Principle:**
- No business logic in controllers
- Controllers are responsible only for HTTP concerns

### `/routes`
Hono route definitions that:
- Map HTTP methods and paths to controllers
- Apply middleware (authentication, validation)
- Organize endpoints by resource

**Structure:**
- Separate route files per resource
- Middleware applied at route level
- Clean separation of public vs protected routes

### `/services`
Business logic layer:
- **auth.service.ts**: JWT token generation/verification, seller authentication
- **cache.service.ts**: Redis caching operations with TTL and invalidation
- **shirt.service.ts**: Shirt CRUD operations, filtering, pagination

**Responsibilities:**
- All business rules live here
- Database operations
- Cache management
- Queue job creation

### `/config`
Infrastructure setup:
- **database.ts**: MongoDB connection management
- **redis.ts**: Redis client singleton
- **queue.ts**: BullMQ queue initialization

**Features:**
- Connection pooling
- Graceful shutdown handling
- Error handling and logging

### `/middlewares`
Request processing middleware:
- **auth.middleware.ts**: JWT verification from HTTP-only cookies
- **error.middleware.ts**: Global error handler and 404 handler

**Purpose:**
- Reusable authentication logic
- Consistent error responses
- Security enforcement

### `/utils`
Shared utilities and type definitions:
- **response.ts**: Standard API response format

## Authentication Flow

### Login Process

1. **Client Request**: POST `/api/auth/login` with email and password
2. **Validation**: Zod schema validates email format and password length
3. **Authentication**: `auth.service.authenticateSeller()`:
   - Finds seller by email
   - Compares password using bcrypt
   - Returns seller document if valid
4. **Token Generation**: JWT created with sellerId and email
5. **Cookie Setting**: HTTP-only cookie set with:
   - `httpOnly: true` - Prevents XSS attacks
   - `sameSite: 'Strict'` - Prevents CSRF attacks
   - `secure: true` in production - Requires HTTPS
   - 7-day expiration
6. **Response**: Returns seller info (without password)

### Protected Route Access

1. **Request**: Any request to protected routes (e.g., `/api/shirts/*`)
2. **Middleware**: `auth.middleware` intercepts request:
   - Extracts `auth_token` from cookies
   - Verifies JWT signature and expiration
   - Extracts sellerId and email from payload
3. **Context Injection**: Sets `sellerId` and `sellerEmail` in Hono context
4. **Controller Access**: Controllers can access `c.get('sellerId')` for authorization

### Logout Process

1. **Client Request**: POST `/api/auth/logout`
2. **Cookie Clearing**: Sets cookie with `maxAge: 0` to expire immediately
3. **Response**: Confirmation message

## MongoDB Indexing Strategy

### Seller Model Indexes

- **email**: Single field index (unique)
  - **Purpose**: Fast login queries
  - **Query Pattern**: `Seller.findOne({ email })`

### Shirt Model Indexes

1. **size**: Single field index
   - **Purpose**: Efficient filtering by size
   - **Query Pattern**: `Shirt.find({ size: 'L' })`

2. **type**: Single field index
   - **Purpose**: Efficient filtering by type
   - **Query Pattern**: `Shirt.find({ type: 'Formal' })`

3. **finalPrice**: Single field index
   - **Purpose**: Range queries for price filtering
   - **Query Pattern**: `Shirt.find({ finalPrice: { $gte: 100, $lte: 500 } })`

4. **sellerId**: Single field index
   - **Purpose**: Fast queries for seller's own shirts
   - **Query Pattern**: `Shirt.find({ sellerId, _id })`

5. **Compound Index**: `{ size: 1, type: 1, finalPrice: 1 }`
   - **Purpose**: Optimizes multi-filter queries
   - **Query Pattern**: `Shirt.find({ size: 'L', type: 'Formal', finalPrice: { $gte: 100 } })`
   - **Benefit**: Single index scan instead of multiple index intersections

### Index Selection Strategy

- **Single field indexes**: Used for individual filters
- **Compound index**: Used when multiple filters are commonly combined
- **Index order matters**: Most selective fields first in compound indexes

## Redis Caching Strategy

### Cache Key Structure

Cache keys follow a hierarchical pattern:
```
shirts:list:size:L:type:Formal:minPrice:100:maxPrice:500:page:1:limit:10
```

**Design Rationale:**
- Includes all filter parameters for accurate cache hits
- Prevents stale data from incorrect cache matches
- Easy to pattern match for invalidation

### Cache Operations

1. **Cache Read** (`getCachedShirtList`):
   - Generates key from filter parameters
   - Attempts Redis GET operation
   - Returns cached data or null (cache miss)
   - Fails silently if Redis unavailable (graceful degradation)

2. **Cache Write** (`setCachedShirtList`):
   - Generates key from filter parameters
   - Stores JSON stringified result
   - Sets TTL of 5 minutes (300 seconds)
   - Fails silently if Redis unavailable

3. **Cache Invalidation** (`invalidateShirtListCache`):
   - Uses `KEYS` pattern matching to find all shirt list keys
   - Deletes all matching keys
   - Called on shirt create/update/delete operations
   - Ensures cache consistency

### TTL Strategy

- **TTL: 5 minutes (300 seconds)**
  - Balance between freshness and performance
  - Short enough to reflect recent changes
  - Long enough to reduce database load significantly

### Cache-Aside Pattern

1. Check cache first
2. If cache hit, return cached data
3. If cache miss:
   - Query database
   - Store result in cache
   - Return result

**Benefits:**
- Reduces database load
- Improves response times
- Graceful degradation if Redis fails

## BullMQ Purpose

### Queue Initialization

BullMQ is initialized with Redis connection for job processing:
- **Queue Name**: `shirt-ecommerce-tasks`
- **Connection**: Uses same Redis instance as caching

### Current Use Cases

1. **Async Logging**:
   - Job type: `log-event`
   - Purpose: Log shirt creation/update events without blocking API response
   - Example: Analytics tracking, audit logs

### Worker Configuration

- **Worker**: Processes jobs asynchronously
- **Queue Events**: Monitors job completion and failures
- **Error Handling**: Logs failures without crashing application

### Future Extensibility

The queue can be extended for:
- Email notifications
- Image processing
- Inventory updates
- Analytics aggregation
- Report generation

## Request Lifecycle

### Example: Creating a Shirt

1. **HTTP Request**: `POST /api/shirts`
   - Headers: Cookie with `auth_token`
   - Body: Shirt data (name, size, type, price, etc.)

2. **Route Matching**: `shirt.routes.ts` matches POST `/api/shirts`

3. **Middleware Execution**:
   - `authMiddleware`: Verifies JWT, extracts sellerId
   - Sets `sellerId` in context

4. **Controller** (`createShirtHandler`):
   - Parses request body
   - Validates with Zod schema
   - Calls `shirt.service.createShirt()`

5. **Service Layer** (`createShirt`):
   - Creates Mongoose document
   - Pre-save hook computes `finalPrice`
   - Saves to MongoDB
   - Invalidates Redis cache
   - Queues async logging job

6. **Response**:
   - Controller formats JSON response
   - Returns 201 status with created shirt data

### Example: Listing Shirts

1. **HTTP Request**: `GET /api/shirts?size=L&type=Formal&page=1&limit=10`

2. **Route Matching**: `shirt.routes.ts` matches GET `/api/shirts`

3. **Middleware**: No authentication required (public endpoint)

4. **Controller** (`listShirtsHandler`):
   - Parses query parameters
   - Validates with Zod schema
   - Calls `shirt.service.listShirts()`

5. **Service Layer** (`listShirts`):
   - **Cache Check**: Attempts to get from Redis
   - **Cache Hit**: Returns cached data immediately
   - **Cache Miss**:
     - Builds MongoDB query with filters
     - Executes query with pagination
     - Stores result in cache with TTL
     - Returns result

6. **Response**: Returns paginated shirt list with metadata

## Error Handling

### Validation Errors

- **Source**: Zod schema validation
- **Response**: 400 Bad Request with error details
- **Format**: `{ success: false, message: "Validation error", errors: [...] }`

### Authentication Errors

- **Source**: Missing/invalid JWT token
- **Response**: 401 Unauthorized
- **Format**: `{ success: false, message: "Authentication required" }`

### Business Logic Errors

- **Source**: Service layer (e.g., shirt not found)
- **Response**: 404 Not Found or 403 Forbidden
- **Format**: `{ success: false, message: "Shirt not found or unauthorized" }`

### Server Errors

- **Source**: Unhandled exceptions
- **Response**: 500 Internal Server Error
- **Format**: `{ success: false, message: "Internal server error" }` (production)
- **Format**: `{ success: false, message: error.message }` (development)

## Security Considerations

1. **JWT in HTTP-only Cookies**:
   - Prevents XSS attacks (JavaScript cannot access cookie)
   - SameSite=Strict prevents CSRF attacks
   - Secure flag in production requires HTTPS

2. **Password Hashing**:
   - bcrypt with salt rounds = 10
   - Passwords never stored in plain text
   - Hashing occurs in pre-save hook

3. **Input Validation**:
   - Zod schemas validate all inputs
   - Prevents injection attacks
   - Type-safe validation

4. **Authorization**:
   - Sellers can only modify their own shirts
   - sellerId verified in service layer

## Performance Optimizations

1. **Database Indexes**: Fast queries on filtered fields
2. **Redis Caching**: Reduces database load for list queries
3. **Connection Pooling**: MongoDB connection reuse
4. **Async Operations**: BullMQ for non-blocking background tasks
5. **Pagination**: Limits data transfer and processing

## Environment Variables

Required environment variables (see `.env.example`):

- `MONGODB_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection string
- `REDIS_HOST`: Redis host (for BullMQ)
- `REDIS_PORT`: Redis port (for BullMQ)
- `JWT_SECRET`: Secret key for JWT signing
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:3000)
- `CORS_ORIGIN`: Alternative to FRONTEND_URL (deprecated, use FRONTEND_URL)

## Deployment Considerations

1. **Database**: Ensure MongoDB is accessible and indexes are created
2. **Redis**: Ensure Redis is running and accessible
3. **Environment Variables**: Set all required variables in production
4. **HTTPS**: Required for secure cookies in production
5. **Graceful Shutdown**: Handles SIGTERM/SIGINT for clean shutdowns
6. **Error Logging**: Implement proper logging service in production
7. **Monitoring**: Monitor Redis, MongoDB, and queue health

