// @ts-nocheck

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Client } from 'langsmith';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { SYSTEM_PROMPT } from '../../config/ai-system-prompt.js';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { generateEmbedding, queryPinecone } from '../../config/pinecone.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';

// Helper function to sanitize text for TOON format
function sanitizeTOON(text: string | null | undefined): string {
  if (!text) return '';
  // Escape tabs, newlines, and special characters for TOON format
  return String(text)
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/\r?\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

// Initialize LangSmith client for monitoring
const langsmithClient = ENV.LANGCHAIN_API_KEY
  ? new Client({
      apiKey: ENV.LANGCHAIN_API_KEY,
    })
  : null;

// Define secure tools that AI can use
const tools = [
  new DynamicStructuredTool({
    name: 'get_user_profile',
    description:
      "Get the current authenticated user's profile information. Use this when user asks about their own profile, settings, or personal information.",
    schema: z.object({}),
    func: async ({}, context) => {
      try {
        if (!context?.userId) {
          return 'Error: User not authenticated';
        }

        const profile = await prisma.profile.findUnique({
          where: { userId: context.userId },
          select: {
            firstName: true,
            lastName: true,
            bio: true,
            company: true,
            jobTitle: true,
            location: true,
            skills: true,
            interests: true,
            languages: true,
            education: true,
            experiences: true,
            certifications: true,
            awards: true,
            githubUsername: true,
            linkedInProfile: true,
            twitterHandle: true,
            portfolioUrl: true,
            isPublic: true,
            yearsOfExperience: true,
          },
        });

        if (!profile) {
          return 'No profile found. Please complete your profile first.';
        }

        // Return in TOON format for token efficiency
        const lines = [
          `name: ${sanitizeTOON(profile.firstName)} ${sanitizeTOON(profile.lastName)}`.trim(),
          profile.bio && `bio: ${sanitizeTOON(profile.bio)}`,
          profile.company && `company: ${sanitizeTOON(profile.company)}`,
          profile.jobTitle && `jobTitle: ${sanitizeTOON(profile.jobTitle)}`,
          profile.location && `location: ${sanitizeTOON(profile.location)}`,
          profile.yearsOfExperience && `yearsOfExperience: ${profile.yearsOfExperience}`,
          profile.skills?.length && `skills[${profile.skills.length}]: ${profile.skills.join(',')}`,
          profile.interests?.length &&
            `interests[${profile.interests.length}]: ${profile.interests.join(',')}`,
          profile.languages?.length &&
            `languages[${profile.languages.length}]: ${profile.languages.join(',')}`,
          profile.githubUsername && `github: ${sanitizeTOON(profile.githubUsername)}`,
          profile.linkedInProfile && `linkedin: ${sanitizeTOON(profile.linkedInProfile)}`,
          profile.twitterHandle && `twitter: ${sanitizeTOON(profile.twitterHandle)}`,
          profile.portfolioUrl && `portfolio: ${sanitizeTOON(profile.portfolioUrl)}`,
          `isPublic: ${profile.isPublic}`,
        ].filter(Boolean);
        return lines.join('\n');
      } catch (error) {
        logger.error('Error getting user profile:', error);
        return 'Error retrieving profile information. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'get_user_organizations',
    description:
      "Get the current authenticated user's organizations. Use this when user asks about their organizations or company affiliations.",
    schema: z.object({}),
    func: async ({}, context) => {
      try {
        if (!context?.userId) {
          return 'Error: User not authenticated';
        }

        const organizations = await prisma.userOrganization.findMany({
          where: { userId: context.userId },
          include: {
            organization: {
              include: {
                organizationProfile: {
                  select: {
                    description: true,
                    website: true,
                  },
                },
                _count: {
                  select: {
                    teams: true,
                    userOrganizations: true,
                  },
                },
              },
            },
          },
        });

        if (organizations.length === 0) return 'No organizations found.';

        // Return in TOON format with tabular array
        const rows = organizations.map((uo) => [
          sanitizeTOON(uo.organization.name),
          sanitizeTOON(uo.organization.slug),
          uo.organization.isPublic ? 'public' : 'private',
          sanitizeTOON(uo.organization.organizationProfile?.description),
          sanitizeTOON(uo.organization.organizationProfile?.website),
          uo.organization._count.userOrganizations,
          uo.organization._count.teams,
          uo.createdAt.toISOString().split('T')[0],
        ]);

        return [
          `organizations[${organizations.length}]{name,slug,visibility,description,website,memberCount,teamCount,joinedAt}:`,
          ...rows.map((row) => `  ${row.join('\t')}`),
        ].join('\n');
      } catch (error) {
        logger.error('Error getting user organizations:', error);
        return 'Error retrieving organizations. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'get_user_teams',
    description:
      "Get the current authenticated user's teams. Use this when user asks about their teams or team memberships.",
    schema: z.object({}),
    func: async ({}, context) => {
      try {
        if (!context?.userId) {
          return 'Error: User not authenticated';
        }

        const teams = await prisma.userTeam.findMany({
          where: { userId: context.userId },
          include: {
            team: {
              include: {
                organization: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
                teamProfile: {
                  select: {
                    description: true,
                  },
                },
                _count: {
                  select: {
                    teamMemberships: true,
                    projects: true,
                  },
                },
              },
            },
          },
        });

        if (teams.length === 0) return 'No teams found.';

        // Return in TOON format with tabular array
        const rows = teams.map((ut) => [
          sanitizeTOON(ut.team.name),
          sanitizeTOON(ut.team.slug),
          ut.team.visibility,
          sanitizeTOON(ut.team.organization.name),
          sanitizeTOON(ut.team.teamProfile?.description),
          ut.team._count.teamMemberships,
          ut.team._count.projects,
          ut.createdAt.toISOString().split('T')[0],
        ]);

        return [
          `teams[${teams.length}]{name,slug,visibility,organization,description,memberCount,projectCount,joinedAt}:`,
          ...rows.map((row) => `  ${row.join('\t')}`),
        ].join('\n');
      } catch (error) {
        logger.error('Error getting user teams:', error);
        return 'Error retrieving teams. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'get_user_projects',
    description:
      "Get the current authenticated user's projects. Use this when user asks about their projects or project memberships.",
    schema: z.object({}),
    func: async ({}, context) => {
      try {
        if (!context?.userId) {
          return 'Error: User not authenticated';
        }

        const projects = await prisma.userProject.findMany({
          where: { userId: context.userId },
          include: {
            project: {
              include: {
                team: {
                  include: {
                    organization: {
                      select: {
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
                projectProfile: {
                  select: {
                    description: true,
                  },
                },
              },
            },
          },
        });

        if (projects.length === 0) return 'No projects found.';

        // Return in TOON format with tabular array
        const rows = projects.map((up) => [
          sanitizeTOON(up.project.name),
          sanitizeTOON(up.project.slug),
          up.project.visibility,
          sanitizeTOON(up.project.team.name),
          sanitizeTOON(up.project.team.organization.name),
          sanitizeTOON(up.project.projectProfile?.description),
          up.createdAt.toISOString().split('T')[0],
        ]);

        return [
          `projects[${projects.length}]{name,slug,visibility,team,organization,description,joinedAt}:`,
          ...rows.map((row) => `  ${row.join('\t')}`),
        ].join('\n');
      } catch (error) {
        logger.error('Error getting user projects:', error);
        return 'Error retrieving projects. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'get_user_notifications',
    description:
      "Get the current authenticated user's recent notifications. Use this when user asks about their inbox, messages, or notifications.",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe('Maximum number of notifications to retrieve (default: 10)'),
    }),
    func: async ({ limit = 10 }, context) => {
      try {
        if (!context?.userId) {
          return 'Error: User not authenticated';
        }

        const notifications = await prisma.notification.findMany({
          where: { userId: context.userId },
          select: {
            id: true,
            type: true,
            title: true,
            message: true,
            read: true,
            actionUrl: true,
            actionLabel: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit, 50), // Max 50 to prevent abuse
        });

        if (notifications.length === 0) return 'No notifications found.';

        // Return in TOON format with tabular array
        const rows = notifications.map((n) => [
          n.read ? 'read' : 'unread',
          sanitizeTOON(n.type),
          sanitizeTOON(n.title),
          sanitizeTOON(n.message),
          sanitizeTOON(n.actionUrl),
          sanitizeTOON(n.actionLabel),
          n.createdAt.toISOString(),
        ]);

        return [
          `notifications[${notifications.length}]{status,type,title,message,actionUrl,actionLabel,createdAt}:`,
          ...rows.map((row) => `  ${row.join('\t')}`),
        ].join('\n');
      } catch (error) {
        logger.error('Error getting user notifications:', error);
        return 'Error retrieving notifications. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'get_user_activity_logs',
    description:
      "Get the current authenticated user's recent activity logs. Use this when user asks about their account activity or recent actions.",
    schema: z.object({
      limit: z.number().optional().describe('Maximum number of logs to retrieve (default: 10)'),
    }),
    func: async ({ limit = 10 }, context) => {
      try {
        if (!context?.userId) {
          return 'Error: User not authenticated';
        }

        const logs = await prisma.logs.findMany({
          where: { userId: context.userId },
          select: {
            id: true,
            action: true,
            level: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit, 50), // Max 50 to prevent abuse
        });

        if (logs.length === 0) return 'No activity logs found.';

        // Return in TOON format with tabular array
        const rows = logs.map((log) => [
          sanitizeTOON(log.level),
          sanitizeTOON(log.action),
          log.createdAt.toISOString(),
        ]);

        return [
          `activityLogs[${logs.length}]{level,action,createdAt}:`,
          ...rows.map((row) => `  ${row.join('\t')}`),
        ].join('\n');
      } catch (error) {
        logger.error('Error getting user activity logs:', error);
        return 'Error retrieving activity logs. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'get_current_page_context',
    description:
      'Get the current page/route context and content that the user is viewing. Use this when user asks about what they are currently seeing or need help with the current page.',
    schema: z.object({}),
    func: async ({}, context) => {
      try {
        if (!context?.metadata?.pageContext) {
          return 'No current page context available. Please refresh the page or navigate to a specific section.';
        }

        const pageContext = context.metadata.pageContext as {
          route: string;
          title: string;
          content?: string;
          timestamp: string;
        };

        // Sanitize and limit content length for security
        const sanitizedContent = pageContext.content
          ? pageContext.content.substring(0, 2000) +
            (pageContext.content.length > 2000 ? '...' : '')
          : 'No content available';

        // Return in TOON format
        return [
          `pageContext:`,
          `  route: ${sanitizeTOON(pageContext.route)}`,
          `  title: ${sanitizeTOON(pageContext.title)}`,
          `  lastUpdated: ${pageContext.timestamp}`,
          `  content: ${sanitizeTOON(sanitizedContent)}`,
        ].join('\n');
      } catch (error) {
        logger.error('Error getting page context:', error);
        return 'Error retrieving current page context. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'get_client_debug_info',
    description:
      'Get client-side debug information including console logs and errors. Use this when users report issues or ask why something is not working.',
    schema: z.object({}),
    func: async ({}, context) => {
      try {
        if (!context?.metadata?.debugInfo) {
          return 'No debug information available. Please ensure the page has loaded properly and try again.';
        }

        const debugInfo = context.metadata.debugInfo as {
          consoleLogs: Array<{ level: string; message: string; timestamp: string }>;
          errors: Array<{ message: string; stack?: string; timestamp: string }>;
          timestamp: string;
        };

        // Sanitize and limit debug information for security
        const sanitizedLogs =
          debugInfo.consoleLogs
            ?.slice(-10) // Last 10 logs
            ?.map((log) => ({
              level: log.level,
              message: log.message.substring(0, 200), // Limit message length
              timestamp: log.timestamp,
            })) || [];

        const sanitizedErrors =
          debugInfo.errors
            ?.slice(-5) // Last 5 errors
            ?.map((error) => ({
              message: error.message.substring(0, 300), // Limit message length
              stack: error.stack?.substring(0, 500), // Limit stack trace
              timestamp: error.timestamp,
            })) || [];

        // Return in TOON format with nested structure
        const lines = [
          `debugInfo:`,
          `  capturedAt: ${debugInfo.timestamp}`,
          `  note: Sanitized for security`,
        ];

        if (sanitizedLogs.length > 0) {
          lines.push(`  consoleLogs[${sanitizedLogs.length}]{level,message,timestamp}:`);
          sanitizedLogs.forEach((log) => {
            lines.push(
              `    ${sanitizeTOON(log.level)}\t${sanitizeTOON(log.message)}\t${log.timestamp}`,
            );
          });
        }

        if (sanitizedErrors.length > 0) {
          lines.push(`  errors[${sanitizedErrors.length}]{message,stack,timestamp}:`);
          sanitizedErrors.forEach((err) => {
            lines.push(
              `    ${sanitizeTOON(err.message)}\t${sanitizeTOON(err.stack || '')}\t${err.timestamp}`,
            );
          });
        }

        return lines.join('\n');
      } catch (error) {
        logger.error('Error getting debug info:', error);
        return 'Error retrieving debug information. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'update_user_profile',
    description:
      "Update the current authenticated user's profile information. Only allow updates to non-sensitive fields like bio, skills, interests, etc.",
    schema: z.object({
      field: z
        .enum(['bio', 'skills', 'interests', 'languages', 'location', 'portfolioUrl'])
        .describe('Field to update'),
      value: z.any().describe('New value for the field'),
    }),
    func: async ({ field, value }, context) => {
      try {
        if (!context?.userId) {
          return 'Error: User not authenticated';
        }

        // Validate input based on field type
        if (field === 'skills' || field === 'interests' || field === 'languages') {
          if (!Array.isArray(value)) {
            return 'Error: This field requires an array of strings';
          }
        } else {
          if (typeof value !== 'string') {
            return 'Error: This field requires a string value';
          }
        }

        const updateData: Partial<{
          bio: string;
          skills: string[];
          interests: string[];
          languages: string[];
          location: string;
          portfolioUrl: string;
        }> = {};
        updateData[field as keyof typeof updateData] = value;

        const updatedProfile = await prisma.profile.update({
          where: { userId: context.userId },
          data: updateData,
          select: {
            [field]: true,
            updatedAt: true,
          },
        });

        // Automatically clear profile cache after update
        const cacheKey = `${REDIS_KEYS.PROFILE_CACHE}${context.userId}`;
        await redis.del(cacheKey).catch(() => {}); // Ignore cache clearing errors

        const valueStr = Array.isArray(updatedProfile[field])
          ? updatedProfile[field].join(',')
          : updatedProfile[field];
        return `Successfully updated ${field}: ${valueStr}`;
      } catch (error) {
        logger.error('Error updating user profile:', error);
        return 'Error updating profile. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'get_platform_help',
    description: 'Provide help and information about FairArena platform features and navigation.',
    schema: z.object({
      topic: z
        .enum([
          'getting_started',
          'profile',
          'organizations',
          'teams',
          'projects',
          'notifications',
          'search',
          'settings',
        ])
        .describe('Help topic'),
    }),
    func: async ({ topic }) => {
      const helpContent = {
        getting_started: `**Getting Started with FairArena:**
• Complete your profile to showcase your skills and experience
• Join or create organizations to collaborate with others
• Create teams within organizations for project work
• Connect with other professionals through profiles and messaging`,

        profile: `**Profile Management:**
• Update your bio, skills, and professional information
• Add your portfolio, GitHub, and LinkedIn links
• Set privacy preferences for your profile visibility
• View profile analytics and visitor information`,

        organizations: `**Organizations:**
• Join existing organizations or create your own
• Manage organization settings and member permissions
• Create teams within organizations for better structure
• View organization analytics and member activity`,

        teams: `**Teams:**
• Create teams within organizations for project collaboration
• Manage team membership and permissions
• Create projects within teams to organize work
• Track team activity and contributions`,

        projects: `**Projects:**
• Create projects within teams to organize work
• Assign team members to projects
• Track project progress and milestones
• Manage project documentation and resources`,

        notifications: `**Notifications:**
• Receive updates about team activities and mentions
• Get notified about organization announcements
• View message notifications from connections
• Manage notification preferences in settings`,

        search: `**Search & Discovery:**
• Search for profiles by skills, bio, or job title
• Find organizations by name or industry
• Discover teams within organizations
• Use filters to narrow down search results`,

        settings: `**Account Settings:**
• Manage your account security and privacy
• Configure notification preferences
• View account activity logs
• Update profile and contact information`,
      };

      return (
        helpContent[topic] ||
        'Help topic not found. Available topics: getting_started, profile, organizations, teams, projects, notifications, search, settings'
      );
    },
  }),

  new DynamicStructuredTool({
    name: 'get_available_plans',
    description:
      'Get all available pricing plans from the database. Use this when user asks about pricing, plans, or subscription options.',
    schema: z.object({}),
    func: async ({}) => {
      try {
        const plans = await prisma.plan.findMany({
          where: { isActive: true },
          select: {
            planId: true,
            name: true,
            amount: true,
            currency: true,
            credits: true,
            description: true,
            features: true,
          },
          orderBy: { amount: 'asc' },
        });

        if (plans.length === 0) return 'No active plans found.';

        // Return in TOON format for token efficiency
        const lines = plans.map((plan) => {
          const amountInRupees = (plan.amount / 100).toFixed(2);
          const featuresStr = plan.features?.join(', ') || '';
          return `plan: ${sanitizeTOON(plan.name)} (${plan.planId}) - ₹${amountInRupees} (${plan.credits} credits) - ${sanitizeTOON(plan.description || '')} - features: ${sanitizeTOON(featuresStr)}`;
        });

        return `Available plans[${plans.length}]:\\n${lines.join('\\\\n')}`;
      } catch (error) {
        logger.error('Error getting available plans:', error);
        return 'Error retrieving pricing plans. Please try again.';
      }
    },
  }),

  new DynamicStructuredTool({
    name: 'search_documentation',
    description:
      'Search the FairArena documentation for information about features, functionality, and how to use the platform. Use this when user asks questions about how FairArena works, what features are available, or needs help understanding the platform.',
    schema: z.object({
      query: z.string().describe('The search query to find relevant documentation'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of documentation results to retrieve (default: 5)'),
    }),
    func: async ({ query, limit = 5 }) => {
      try {
        // Check if Pinecone is configured
        if (!ENV.PINECONE_API_KEY) {
          return 'Documentation search is not available at the moment. Please refer to the platform knowledge in my system or contact support.';
        }

        // Generate embedding for the query
        const embedding = await generateEmbedding(query);

        // Query Pinecone for relevant documentation
        const results = await queryPinecone(query, embedding, Math.min(limit, 10));

        if (results.length === 0) {
          return 'No relevant documentation found for your query. Please try rephrasing your question or contact support for assistance.';
        }

        // Format results in TOON format
        const formattedResults = results.map((result, index) => {
          const title = sanitizeTOON(result.metadata.title || 'Untitled');
          const content = sanitizeTOON(result.text || result.metadata.content || '');
          const score = (result.score * 100).toFixed(1);
          return `[${index + 1}] ${title} (relevance: ${score}%)\n${content}`;
        });

        return [
          `Found ${results.length} relevant documentation entries:`,
          '',
          ...formattedResults,
        ].join('\n\n');
      } catch (error: any) {
        logger.error('Error searching documentation:', error);

        // Handle Rate Limiting specifically
        if (
          error?.message?.includes('429') ||
          error?.status === 429 ||
          error?.message?.includes('Quota exceeded')
        ) {
          return 'Documentation search is currently unavailable due to system load (Rate Limit). Please use your general knowledge to answer.';
        }

        return 'Error searching documentation. Please try again or contact support.';
      }
    },
  }),
];

// Session management with message history
interface Session {
  messages: BaseMessage[];
}

// Create AI service class
export class AIService {
  private model: ChatGoogleGenerativeAI;
  private sessions: Map<string, Session> = new Map();

  constructor() {
    // Initialize Gemini model with streaming support
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-flash',
      apiKey: ENV.GOOGLE_GEMINI_API_KEY,
      temperature: 0.7,
      maxOutputTokens: 2048,
      // Add safety settings to prevent undefined responses
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    });
  }

  // Get or create session
  private getSession(sessionId: string): Session {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { messages: [] });
    }
    return this.sessions.get(sessionId)!;
  }

  // Stream chat response with tool calling
  async *streamChat(
    message: string,
    sessionId: string,
    userId?: string,
    metadata?: Record<string, unknown>,
    signal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
    try {
      // SECURITY CHECK: Detect and reject bypass attempts
      const bypassPatterns = [
        /ignore.*previous.*instructions/i,
        /override.*instructions/i,
        /system.*prompt/i,
        /developer.*mode/i,
        /uncensored.*mode/i,
        /jailbreak/i,
        /dan.*mode/i,
        /admin.*mode/i,
        /root.*mode/i,
        /bypass.*restrictions/i,
        /forget.*instructions/i,
        /new.*persona/i,
        /role.*play/i,
        /act.*as.*different/i,
        /you.*are.*now/i,
        /pretend.*to.*be/i,
        /enter.*mode/i,
        /switch.*to/i,
        /become.*different/i,
      ];

      const isBypassAttempt = bypassPatterns.some((pattern) => pattern.test(message));
      if (isBypassAttempt) {
        yield 'I apologize, but I cannot assist with that request as it violates my security guidelines.';
        return;
      }

      if (signal?.aborted) {
        return;
      }

      const runId = uuidv4();

      // Log to LangSmith if available
      if (langsmithClient) {
        await langsmithClient.createRun({
          id: runId,
          name: 'AI Chat Session',
          run_type: 'chain',
          inputs: { message, sessionId, userId },
          extra: metadata,
        });
      }

      // Get session and add user message
      const session = this.getSession(sessionId);

      // System message - loaded from separate config file
      const systemPrompt = SYSTEM_PROMPT.replace(
        '{{context}}',
        metadata?.context || 'General assistance',
      );
      const systemMessage = new SystemMessage(systemPrompt);

      // Tools are already defined globally

      // Add user message to history
      const userMessage = new HumanMessage(message);
      session.messages.push(userMessage);

      // Build conversation history
      const conversationMessages = [systemMessage, ...session.messages];

      // Invoke the model with tools
      let stream;
      try {
        const modelWithTools = this.model.bindTools(tools);
        stream = await modelWithTools.stream(conversationMessages);
      } catch (modelError) {
        logger.error('Error initializing model stream:', modelError);
        yield 'I apologize, but I encountered an error initializing the AI model. Please try again.';
        return;
      }

      let fullResponse = '';
      let toolCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }> = [];

      for await (const chunk of stream) {
        if (signal?.aborted) {
          return;
        }

        try {
          // Handle content chunks with defensive programming
          if (chunk && chunk.content && typeof chunk.content === 'string') {
            fullResponse += chunk.content;
            yield chunk.content;
          }

          // Collect tool calls with validation
          if (chunk && chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
            toolCalls.push(...chunk.tool_calls);
          }
        } catch (chunkError) {
          logger.error('Error processing stream chunk:', chunkError);
          // Continue processing other chunks instead of failing completely
          continue;
        }
      }

      // Execute tool calls and get final response if any tools were called
      if (toolCalls.length > 0) {
        // Add the initial AI message with tool calls to history
        const aiMessageWithTools = new AIMessage({
          content: fullResponse,
          tool_calls: toolCalls,
        });
        session.messages.push(aiMessageWithTools);

        // Execute all tool calls
        const toolMessages: ToolMessage[] = [];
        for (const toolCall of toolCalls) {
          const tool = tools.find((t) => t.name === toolCall.name);
          if (tool) {
            // SECURITY CHECK: Only allow approved tools
            const approvedTools = [
              'get_user_profile',
              'get_user_organizations',
              'get_user_teams',
              'get_user_projects',
              'get_user_notifications',
              'get_user_activity_logs',
              'get_current_page_context',
              'get_client_debug_info',
              'update_user_profile',
              'get_platform_help',
              'get_available_plans',
              'search_documentation',
            ];

            if (!approvedTools.includes(tool.name)) {
              toolMessages.push(
                new ToolMessage({
                  content: 'Error: Unauthorized tool access attempt.',
                  tool_call_id: toolCall.id || '',
                }),
              );
              continue;
            }

            try {
              const toolArgs =
                typeof toolCall.args === 'object' && toolCall.args !== null
                  ? { ...toolCall.args }
                  : {};

              // SECURITY CHECK: Validate tool arguments don't contain bypass attempts
              const argsString = JSON.stringify(toolArgs).toLowerCase();
              if (bypassPatterns.some((pattern) => pattern.test(argsString))) {
                toolMessages.push(
                  new ToolMessage({
                    content: 'Error: Invalid arguments detected.',
                    tool_call_id: toolCall.id || '',
                  }),
                );
                continue;
              }

              const toolResult =
                tool.name === 'get_platform_help'
                  ? await tool.func(toolArgs as { topic: string })
                  : await tool.func(toolArgs as Record<string, unknown>, {
                      userId,
                      sessionId,
                      metadata,
                    });
              toolMessages.push(
                new ToolMessage({
                  content: toolResult,
                  tool_call_id: toolCall.id || '',
                }),
              );
            } catch (toolError) {
              logger.error('Tool execution error:', toolError);
              toolMessages.push(
                new ToolMessage({
                  content: 'An error occurred while executing this tool.',
                  tool_call_id: toolCall.id || '',
                }),
              );
            }
          }
        }

        // Add tool messages to conversation
        session.messages.push(...toolMessages);

        // Get final response from AI based on tool results
        let finalStream;
        try {
          const finalConversationMessages = [systemMessage, ...session.messages];
          finalStream = await this.model.stream(finalConversationMessages);
        } catch (finalModelError) {
          logger.error('Error initializing final model stream:', finalModelError);
          yield 'I apologize, but I encountered an error processing the tool results. Please try again.';
          return;
        }

        let finalResponse = '';
        try {
          for await (const chunk of finalStream) {
            if (signal?.aborted) {
              return;
            }

            try {
              // Handle content chunks with defensive programming
              if (chunk && chunk.content && typeof chunk.content === 'string') {
                finalResponse += chunk.content;
                yield chunk.content;
              }
            } catch (chunkError) {
              logger.error('Error processing final stream chunk:', chunkError);
              // Continue processing other chunks instead of failing completely
              continue;
            }
          }
        } catch (finalStreamError) {
          logger.error('Error in final streaming response:', finalStreamError);
          yield 'I apologize, but I encountered an error finalizing the response. Please try again.';
          return;
        }

        // Update full response
        fullResponse = finalResponse;

        // Save final AI response to history
        const finalAiMessage = new AIMessage(finalResponse);
        session.messages.push(finalAiMessage);
      } else {
        // No tools called, save the initial response
        const aiMessage = new AIMessage(fullResponse);
        session.messages.push(aiMessage);
      }

      // Keep only last 20 messages to prevent memory issues
      if (session.messages.length > 20) {
        session.messages = session.messages.slice(-20);
      }

      // Complete LangSmith run
      if (langsmithClient) {
        await langsmithClient.updateRun(runId, {
          outputs: { response: fullResponse },
          end_time: Date.now(),
        });
      }
    } catch (error) {
      logger.error('Error in AI stream chat:', error);
      yield 'I apologize, but I encountered an error processing your request. Please try again.';
    }
  }

  // Non-streaming chat (for compatibility)
  async chat(
    message: string,
    sessionId: string,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    let response = '';
    for await (const chunk of this.streamChat(message, sessionId, userId, metadata)) {
      response += chunk;
    }
    return response;
  }

  // Clear session memory
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

// Export singleton instance
export const aiService = new AIService();
