# FairArena - GitHub Copilot Instructions

## Project Context

FairArena is an enterprise-grade full-stack platform for skill assessment, built with modern technologies and production-ready architecture.

**Repository:** FairArena/FairArena (Proprietary)
**Production URL:** https://fair.sakshamg.me
**API Base:** https://fairarena.sakshamg.me/api/v1
**Author:** Saksham Goel (@Saksham-Goel1107)

## Technology Stack

### Frontend (React + TypeScript)
- React 19.2 with TypeScript 5.9 (strict mode)
- Vite 7.3 for build tooling
- TailwindCSS 4.1 for styling
- Radix UI + Shadcn UI for components
- Clerk for authentication
- React Router v7 for routing
- Axios for HTTP requests
- Socket.IO for real-time features
- React Hook Form + Zod for forms
- Framer Motion for animations

### Backend (Node.js + Express)
- Node.js 20 LTS with Express 5.2
- TypeScript 5.9 (strict mode)
- Prisma 7.2 ORM (PostgreSQL)
- Clerk Express for JWT auth
- Inngest for background jobs (34+ functions)
- Redis (Upstash) for caching
- Resend for transactional emails
- Google Gemini + LangChain for AI
- Razorpay for payments
- OpenTelemetry + SigNoz for observability

### Infrastructure
- PostgreSQL 15+ with read replicas
- Docker + Docker Compose
- Caddy reverse proxy
- Cloudflare WAF + CDN
- Azure Blob Storage
- pnpm package manager

## Code Generation Guidelines

### General Principles

1. **Type Safety First**
   - Always use TypeScript with strict mode
   - Define interfaces/types before implementation
   - Use Zod for runtime validation
   - Avoid `any` type; use `unknown` if needed

2. **Async/Await Pattern**
   ```typescript
   // Always use async/await, never callbacks
   try {
     const result = await operation();
     return result;
   } catch (error) {
     logger.error('Operation failed', { error });
     throw error;
   }
   ```

3. **Error Handling**
   - Always implement try-catch blocks
   - Log errors with context using Winston
   - Return consistent error responses
   - Track errors with Sentry

4. **Security**
   - Never hardcode secrets (use environment variables)
   - Validate all inputs with Zod
   - Sanitize HTML with DOMPurify
   - Use parameterized queries (Prisma)
   - Implement rate limiting (Arcjet)

### React Component Patterns

```typescript
// Use functional components with TypeScript
interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUpdate }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get(`/profile/${userId}`);
        setUser(data);
      } catch (error) {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  if (loading) return <Skeleton />;
  if (!user) return <ErrorState />;

  return (
    <div className="profile-container">
      {/* Component content */}
    </div>
  );
};
```

### API Endpoint Patterns (Express)

```typescript
// Backend controller pattern
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';

const requestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export const createUser = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = requestSchema.parse(req.body);

    // Business logic
    const user = await prisma.user.create({
      data: validatedData,
    });

    logger.info('User created', { userId: user.id });

    return res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('User creation failed', { error, body: req.body });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
```

### Database Queries (Prisma)

```typescript
// Use transactions for multi-table operations
import { prisma } from '@/config/database';

// Simple query
const user = await prisma.user.findUnique({
  where: { userId },
  include: {
    profile: true,
    settings: true,
  },
});

// Transaction example
const result = await prisma.$transaction(async (tx) => {
  const payment = await tx.payment.update({
    where: { id: paymentId },
    data: { status: 'COMPLETED' },
  });

  const transaction = await tx.creditTransaction.create({
    data: {
      userId: payment.userId,
      amount: payment.credits,
      type: 'PURCHASE',
      description: `Purchase from ${payment.planName}`,
    },
  });

  return { payment, transaction };
});

// Use select to minimize data transfer
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    profile: {
      select: {
        bio: true,
        skills: true,
      },
    },
  },
  where: {
    isDeleted: false,
  },
});
```

### Redis Caching Pattern

```typescript
import { redis } from '@/config/redis';

const CACHE_TTL = 3600; // 1 hour

async function getCachedUserProfile(userId: string) {
  // Try cache first
  const cacheKey = `user:profile:${userId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const profile = await prisma.profile.findUnique({
    where: { userId },
  });

  // Cache the result
  if (profile) {
    await redis.set(cacheKey, JSON.stringify(profile), 'EX', CACHE_TTL);
  }

  return profile;
}

// Invalidate cache on update
async function updateUserProfile(userId: string, data: any) {
  const updated = await prisma.profile.update({
    where: { userId },
    data,
  });

  // Invalidate cache
  await redis.del(`user:profile:${userId}`);

  return updated;
}
```

### Background Jobs (Inngest)

```typescript
import { inngest } from '@/inngest/client';

// Define event-driven function
export const sendWelcomeEmail = inngest.createFunction(
  { id: 'send-welcome-email' },
  { event: 'user/created' },
  async ({ event, step }) => {
    const { userId, email } = event.data;

    // Step 1: Fetch user data
    const user = await step.run('fetch-user', async () => {
      return await prisma.user.findUnique({
        where: { userId },
        include: { profile: true },
      });
    });

    // Step 2: Send email
    await step.run('send-email', async () => {
      await resend.emails.send({
        from: 'FairArena <noreply@fairarena.app>',
        to: email,
        subject: 'Welcome to FairArena!',
        react: WelcomeEmail({ user }),
      });
    });

    return { success: true };
  }
);

// Trigger event
await inngest.send({
  name: 'user/created',
  data: {
    userId: newUser.userId,
    email: newUser.email,
  },
});
```

### Form Handling with React Hook Form + Zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const profileSchema = z.object({
  bio: z.string().min(10).max(500),
  skills: z.array(z.string()).min(1),
  yearsOfExperience: z.number().int().min(0).max(50),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const ProfileForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await api.put('/profile', data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <textarea {...register('bio')} />
      {errors.bio && <span>{errors.bio.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
};
```

## Project Structure Awareness

### Backend Structure
```
Backend/src/
├── config/              # Configuration files (database, redis, etc.)
├── controllers/v1/      # Request handlers
├── email/templates/     # React Email templates
├── inngest/v1/         # Background job functions
├── middleware/          # Express middleware
├── routes/v1/          # API routes
├── services/v1/        # Business logic layer
├── utils/              # Shared utilities
└── index.ts            # Application entry
```

### Frontend Structure
```
Frontend/src/
├── components/         # Reusable UI components
├── pages/             # Page components
├── contexts/          # React contexts
├── hooks/             # Custom hooks
├── services/          # API service layer
├── lib/               # Utility functions
└── config/            # App configuration
```

## Naming Conventions

- **Files:** camelCase for utilities, PascalCase for React components
- **Components:** `UserProfile.tsx`, `ProfileCard.tsx`
- **Services:** `userService.ts`, `apiClient.ts`
- **Utilities:** `formatDate.ts`, `validation.ts`
- **Constants:** `API_ENDPOINTS.ts`, `ROUTES.ts` (UPPER_SNAKE_CASE values)
- **Types:** `User.types.ts`, `api.types.ts`

## Import Organization

```typescript
// 1. External dependencies
import React, { useState, useEffect } from 'react';
import { z } from 'zod';

// 2. Internal modules (absolute imports)
import { api } from '@/services/api';
import { Button } from '@/components/ui/Button';

// 3. Relative imports
import { formatDate } from './utils';
import { UserCard } from './UserCard';

// 4. Types
import type { User } from '@/types';

// 5. Styles (if any)
import './styles.css';
```

## Database Schema Reference

Key models to be aware of when generating code:

- **User:** Core user model with authentication
- **Profile:** Extended user profile information
- **Organization:** Multi-org support
- **Team:** Team management within orgs
- **Project:** Project collaboration
- **Payment:** Razorpay payment tracking
- **CreditTransaction:** Credit balance ledger
- **Notification:** User notifications
- **Support:** Support ticket system
- **Settings:** User preferences (JSON field)

## API Conventions

### Request/Response Format
```typescript
// Success response
{
  "success": true,
  "data": { /* response data */ }
}

// Error response
{
  "success": false,
  "error": "Error message",
  "details": { /* optional error details */ }
}
```

### Common Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Status Codes
- 200: Success
- 201: Created
- 400: Bad Request (validation errors)
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Environment Variables

When generating code that needs configuration:

### Backend
```typescript
// Use from @/config/env.ts (validated with Zod)
import { env } from '@/config/env';

const apiKey = env.GOOGLE_GEMINI_API_KEY;
```

### Frontend
```typescript
// Access via import.meta.env (Vite)
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

## Testing Considerations

When suggesting code, consider testability:

```typescript
// Make functions pure and testable
export const calculateCredits = (plans: Plan[]): number => {
  return plans.reduce((sum, plan) => sum + plan.credits, 0);
};

// Separate side effects
export const fetchAndCalculate = async () => {
  const plans = await fetchPlans();
  return calculateCredits(plans);
};
```

## Common Utilities

Reference these existing utilities when generating code:

- **Logging:** `logger.info()`, `logger.error()`, `logger.warn()`
- **Date formatting:** Use `date-fns` library
- **Currency:** Format with `Intl.NumberFormat` (INR)
- **Validation:** Use Zod schemas defined in `@/utils/validation`
- **API client:** Use centralized `@/services/api`

## Performance Best Practices

1. **Lazy load React components:** Use `React.lazy()` for heavy components
2. **Memoize expensive computations:** Use `useMemo()` and `useCallback()`
3. **Implement virtual scrolling** for long lists
4. **Cache API responses** with React Query or SWR
5. **Use database indexes** for frequently queried fields
6. **Implement pagination** for large datasets
7. **Optimize images** (WebP format, lazy loading)

## Accessibility

Generate accessible code by default:

```tsx
// Good example
<button
  aria-label="Close dialog"
  onClick={onClose}
  className="close-button"
>
  <X aria-hidden="true" />
</button>

// Form with proper labels
<label htmlFor="email">Email</label>
<input
  id="email"
  type="email"
  aria-required="true"
  aria-describedby="email-error"
/>
```

## Documentation

When generating new functions/components, include JSDoc:

```typescript
/**
 * Fetches user profile data with caching
 *
 * @param userId - The unique user identifier
 * @param options - Optional fetch configuration
 * @returns Promise resolving to user profile
 * @throws {NotFoundError} When user doesn't exist
 * @throws {AuthError} When user is not authorized
 *
 * @example
 * ```typescript
 * const profile = await getUserProfile('user_123');
 * ```
 */
export async function getUserProfile(
  userId: string,
  options?: FetchOptions
): Promise<UserProfile> {
  // Implementation
}
```

## Git Commit Message Format

When suggesting code changes, recommend commit messages:

```
feat: add user profile caching with Redis
fix: resolve payment webhook signature validation
refactor: optimize database query performance
docs: update API documentation for credits endpoint
chore: upgrade Prisma to version 7.2
```

## Important Reminders

1. **Never commit secrets** - All credentials via environment variables
2. **Validate inputs** - Both client and server side with Zod
3. **Use transactions** - For operations affecting multiple tables
4. **Implement idempotency** - Especially for payments
5. **Cache strategically** - But invalidate correctly
6. **Log with context** - But never log sensitive data
7. **Rate limit** - All public endpoints via Arcjet
8. **Version APIs** - Currently on v1
9. **Test payment flows** - Always use sandbox mode first
10. **Monitor errors** - Sentry integration is active

## Resources

- Swagger API Docs: http://localhost:3000/api-docs
- Postman Collection: `Backend/postman/FairArena_API.postman_collection.json`
- System Architecture: `Backend/docs/SYSTEM_ARCHITECTURE.md`
- Database Design: `Backend/docs/DATABASE_DESIGN.md`
- Infrastructure Guide: `Backend/docs/INFRASTRUCTURE.md`

---

**Note:** This project uses strict TypeScript mode, comprehensive error handling, and production-grade patterns. Generate code that matches these standards.
