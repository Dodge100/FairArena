import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatGroq } from '@langchain/groq';
import { z } from 'zod';
import { ReportSeverity, ReportType } from '../../generated/enums.js';
import logger from '../../utils/logger.js';

// Define the output schema for the AI classification
const classificationSchema = z.object({
    shortDescription: z
        .string()
        .min(10)
        .max(200)
        .describe('A concise summary of the support ticket in 10-200 characters'),
    type: z
        .enum(['BUG', 'FEATURE_REQUEST', 'QUERY', 'SUGGESTION', 'OTHER'])
        .describe('The type of support request: BUG, FEATURE_REQUEST, QUERY, SUGGESTION, or OTHER'),
    severity: z
        .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
        .describe(
            'The severity level: LOW (minor issues), MEDIUM (moderate impact), HIGH (significant impact), or CRITICAL (urgent/blocking issues)',
        ),
    reasoning: z
        .string()
        .optional()
        .describe('Brief explanation of the classification decision'),
});

export type SupportClassification = z.infer<typeof classificationSchema>;

export class AIClassificationService {
    private model: ChatGroq;
    private parser: ReturnType<typeof StructuredOutputParser.fromZodSchema<typeof classificationSchema>>;
    private promptTemplate: PromptTemplate;

    constructor() {
        // Initialize Groq model
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY environment variable is not set');
        }

        this.model = new ChatGroq({
            apiKey,
            model: 'llama-3.3-70b-versatile', // Using the latest Llama model for best performance
            temperature: 0.3, // Lower temperature for more consistent classifications
            maxTokens: 500,
        });

        // Initialize the output parser
        this.parser = StructuredOutputParser.fromZodSchema(classificationSchema);

        // Create the prompt template
        this.promptTemplate = PromptTemplate.fromTemplate(
            `You are an expert support ticket classifier for a software platform. Your task is to analyze support tickets and classify them accurately.

Analyze the following support ticket and provide a classification:

Subject: {subject}
Message: {message}

Classification Guidelines:
1. TYPE:
   - BUG: Technical issues, errors, crashes, or unexpected behavior
   - FEATURE_REQUEST: Requests for new features or enhancements
   - QUERY: Questions about how to use the platform or clarifications
   - SUGGESTION: Ideas for improvements or feedback
   - OTHER: Anything that doesn't fit the above categories

2. SEVERITY:
   - CRITICAL: System down, data loss, security issues, or blocking production use
   - HIGH: Major functionality broken, significant impact on user workflow
   - MEDIUM: Moderate issues that have workarounds or affect non-critical features
   - LOW: Minor issues, cosmetic problems, or nice-to-have improvements

3. SHORT DESCRIPTION:
   - Create a concise, professional summary (10-200 characters)
   - Focus on the core issue or request
   - Use clear, actionable language
   - Avoid unnecessary details

{format_instructions}

Provide your classification:`,
        );
    }

    async classifySupportTicket(
        subject: string,
        message: string,
    ): Promise<SupportClassification> {
        try {
            logger.info('Starting AI classification for support ticket', {
                subjectLength: subject.length,
                messageLength: message.length,
            });

            // Get format instructions from the parser
            const formatInstructions = this.parser.getFormatInstructions();

            // Format the prompt
            const prompt = await this.promptTemplate.format({
                subject,
                message,
                format_instructions: formatInstructions,
            });

            // Invoke the model
            const response = await this.model.invoke(prompt);

            // Parse the response
            const classification = await this.parser.parse(response.content as string);

            logger.info('AI classification completed successfully', {
                type: classification.type,
                severity: classification.severity,
                shortDescription: classification.shortDescription,
            });

            return classification;
        } catch (error) {
            logger.error('Error during AI classification', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });

            // Return fallback classification
            return this.getFallbackClassification(subject, message);
        }
    }

    private getFallbackClassification(subject: string, message: string): SupportClassification {
        logger.warn('Using fallback classification due to AI failure');

        const combinedText = `${subject} ${message}`.toLowerCase();

        // Determine type based on keywords
        let type: ReportType = ReportType.OTHER;
        if (
            combinedText.includes('error') ||
            combinedText.includes('bug') ||
            combinedText.includes('crash') ||
            combinedText.includes('broken') ||
            combinedText.includes('not working') ||
            combinedText.includes('issue')
        ) {
            type = ReportType.BUG;
        } else if (
            combinedText.includes('feature') ||
            combinedText.includes('add') ||
            combinedText.includes('implement') ||
            combinedText.includes('enhancement')
        ) {
            type = ReportType.FEATURE_REQUEST;
        } else if (
            combinedText.includes('how to') ||
            combinedText.includes('question') ||
            combinedText.includes('help') ||
            combinedText.includes('?')
        ) {
            type = ReportType.QUERY;
        } else if (
            combinedText.includes('suggest') ||
            combinedText.includes('improve') ||
            combinedText.includes('better')
        ) {
            type = ReportType.SUGGESTION;
        }

        // Determine severity based on keywords
        let severity: ReportSeverity = ReportSeverity.LOW;
        if (
            combinedText.includes('critical') ||
            combinedText.includes('urgent') ||
            combinedText.includes('down') ||
            combinedText.includes('data loss') ||
            combinedText.includes('security')
        ) {
            severity = ReportSeverity.CRITICAL;
        } else if (
            combinedText.includes('important') ||
            combinedText.includes('major') ||
            combinedText.includes('blocking')
        ) {
            severity = ReportSeverity.HIGH;
        } else if (combinedText.includes('moderate') || combinedText.includes('medium')) {
            severity = ReportSeverity.MEDIUM;
        }

        // Generate a simple short description
        const shortDescription =
            subject.length <= 200
                ? subject
                : subject.substring(0, 197) + '...';

        return {
            type,
            severity,
            shortDescription,
            reasoning: 'Fallback classification used due to AI service unavailability',
        };
    }

    async classifyBatch(
        tickets: Array<{ id: string; subject: string; message: string }>,
    ): Promise<Map<string, SupportClassification>> {
        const results = new Map<string, SupportClassification>();

        logger.info('Starting batch classification', { count: tickets.length });

        // Process tickets with rate limiting (avoid overwhelming the API)
        for (const ticket of tickets) {
            try {
                const classification = await this.classifySupportTicket(ticket.subject, ticket.message);
                results.set(ticket.id, classification);

                // Add a small delay between requests to avoid rate limiting
                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
                logger.error('Error classifying ticket in batch', {
                    ticketId: ticket.id,
                    error: error instanceof Error ? error.message : String(error),
                });

                // Use fallback for failed classifications
                results.set(ticket.id, this.getFallbackClassification(ticket.subject, ticket.message));
            }
        }

        logger.info('Batch classification completed', {
            total: tickets.length,
            successful: results.size,
        });

        return results;
    }
}

// Export a singleton instance
let aiClassificationServiceInstance: AIClassificationService | null = null;

export function getAIClassificationService(): AIClassificationService {
    if (!aiClassificationServiceInstance) {
        aiClassificationServiceInstance = new AIClassificationService();
    }
    return aiClassificationServiceInstance;
}
