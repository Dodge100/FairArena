import swaggerJsdoc from 'swagger-jsdoc';
import { ENV } from './env.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FairArena API Documentation',
      version: '1.0.0',
      description: `
# FairArena API

Welcome to the FairArena API documentation. This API provides comprehensive endpoints for managing profiles, organizations, teams, payments, AI assistance, and more.

## Authentication

Most endpoints require authentication using Clerk. Include your authentication token in the request headers.

## Rate Limiting

API endpoints are protected with rate limiting using Arcjet to ensure fair usage.

## Base URL

- **Development:** http://localhost:3000
- **Production:** ${ENV.BASE_URL}

## Support

For support, please contact the development team.
      `,
      contact: {
        name: 'FairArena Development Team',
        url: `${ENV.FRONTEND_URL}/support`,
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: ENV.BASE_URL,
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        ClerkAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk authentication token',
        },
        CookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: '__session',
          description: 'Clerk session cookie',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Error message',
                },
                status: {
                  type: 'integer',
                  description: 'HTTP status code',
                },
              },
            },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
              description: 'Clerk user ID',
            },
            username: {
              type: 'string',
              nullable: true,
            },
            email: {
              type: 'string',
              format: 'email',
            },
            name: {
              type: 'string',
              nullable: true,
            },
            bio: {
              type: 'string',
              nullable: true,
            },
            location: {
              type: 'string',
              nullable: true,
            },
            website: {
              type: 'string',
              format: 'uri',
              nullable: true,
            },
            avatarUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
            },
            githubUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
            },
            linkedinUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
            },
            twitterUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
            },
            isPublic: {
              type: 'boolean',
              default: true,
            },
            viewCount: {
              type: 'integer',
              default: 0,
            },
            starCount: {
              type: 'integer',
              default: 0,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Organization: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            slug: {
              type: 'string',
            },
            description: {
              type: 'string',
              nullable: true,
            },
            avatarUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
            },
            website: {
              type: 'string',
              format: 'uri',
              nullable: true,
            },
            isPublic: {
              type: 'boolean',
              default: true,
            },
            memberCount: {
              type: 'integer',
              default: 0,
            },
            starCount: {
              type: 'integer',
              default: 0,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: ['info', 'success', 'warning', 'error'],
            },
            title: {
              type: 'string',
            },
            message: {
              type: 'string',
            },
            read: {
              type: 'boolean',
              default: false,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Report: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            reporterId: {
              type: 'string',
            },
            reportedId: {
              type: 'string',
            },
            reportType: {
              type: 'string',
              enum: ['profile', 'organization', 'project', 'comment'],
            },
            reason: {
              type: 'string',
            },
            description: {
              type: 'string',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
              default: 'pending',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant'],
            },
            content: {
              type: 'string',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            isStreaming: {
              type: 'boolean',
              nullable: true,
            },
          },
        },
        PaymentOrder: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            amount: {
              type: 'integer',
              description: 'Amount in smallest currency unit (paise for INR)',
            },
            currency: {
              type: 'string',
              default: 'INR',
            },
            receipt: {
              type: 'string',
            },
            status: {
              type: 'string',
            },
          },
        },
      },
      parameters: {
        ProfileIdParam: {
          name: 'profileId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'Profile ID',
        },
        UserIdParam: {
          name: 'userId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'User ID (Clerk)',
        },
        OrganizationSlugParam: {
          name: 'slug',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'Organization slug',
        },
        PageParam: {
          name: 'page',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1,
          },
          description: 'Page number for pagination',
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          description: 'Number of items per page',
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: {
                  message: 'Unauthorized',
                  status: 401,
                },
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Access forbidden',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: {
                  message: 'Forbidden',
                  status: 403,
                },
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: {
                  message: 'Not found',
                  status: 404,
                },
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: {
                  message: 'Validation failed',
                  status: 400,
                },
              },
            },
          },
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: {
                  message: 'Rate limit exceeded. Please try again later.',
                  status: 429,
                },
              },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: {
                  message: 'Internal server error',
                  status: 500,
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        ClerkAuth: [],
      },
      {
        CookieAuth: [],
      },
    ],
    tags: [
      {
        name: 'Profile',
        description: 'Profile management endpoints',
      },
      {
        name: 'Account Settings',
        description: 'Account settings and security',
      },
      {
        name: 'Organization',
        description: 'Organization management',
      },
      {
        name: 'AI Assistant',
        description: 'AI-powered chat assistant',
      },
      {
        name: 'Notifications',
        description: 'User notifications',
      },
      {
        name: 'Reports',
        description: 'Content reporting',
      },
      {
        name: 'Stars',
        description: 'Star/favorite profiles and organizations',
      },
      {
        name: 'Payments',
        description: 'Payment processing with Razorpay',
      },
      {
        name: 'Newsletter',
        description: 'Newsletter subscription',
      },
      {
        name: 'Platform Invite',
        description: 'Platform invitation system',
      },
      {
        name: 'Webhooks',
        description: 'Webhook endpoints',
      },
      {
        name: 'System',
        description: 'System endpoints (health, metrics, cleanup)',
      },
    ],
    // Custom UI configuration to fix CSP and improve appearance
    'x-logo': {
      url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMxODI4MzciLz4KPHBhdGggZD0iTTIwIDIwQzIyLjc2MTQgMjAgMjUgMTcuNzYxNCAyNSAxNUMyNSAxMi4yMzg2IDIyLjc2MTQgMTAgMjAgMTBDMTcuMjM4NiAxMCAxNSAxMi4yMzg2IDE1IDE1QzE1IDE3Ljc2MTQgMTcgMjAgMTdDMjEuNTIyOCAxNyAyMiAxNS41MjI4IDIyIDE1QzIyIDE0LjQ0NzIgMjEuNTUyOCAxNCAyMSAxNFoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
      altText: 'FairArena API',
    },
  },
  apis: ['./src/routes/v1/*.ts', './src/routes/v1/*.js'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
