/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import logger from '../utils/logger.js';
import { ENV } from './env.js';

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    if (!ENV.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is not configured');
    }

    pineconeClient = new Pinecone({
      apiKey: ENV.PINECONE_API_KEY,
    });

    logger.info('Pinecone client initialized');
  }

  return pineconeClient;
}

/**
 * Query Pinecone vector database for relevant documentation
 * @param query - The search query
 * @param topK - Number of results to return (default: 5)
 * @param namespace - Optional namespace to search within
 * @returns Array of relevant documents with metadata
 */
export async function queryPinecone(
  query: string,
  embedding: number[],
  topK: number = 5,
  namespace?: string,
): Promise<
  Array<{
    id: string;
    score: number;
    metadata: Record<string, any>;
    text?: string;
  }>
> {
  try {
    const client = getPineconeClient();
    const index = client.index(ENV.PINECONE_INDEX_NAME);

    const queryResponse = await index.namespace(namespace || '').query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    const results = queryResponse.matches.map((match) => ({
      id: match.id,
      score: match.score || 0,
      metadata: (match.metadata as Record<string, any>) || {},
      text: (match.metadata?.text as string) || '',
    }));

    logger.info(`Pinecone query returned ${results.length} results`, {
      query: query.substring(0, 100),
      topK,
      namespace,
    });

    return results;
  } catch (error) {
    logger.error('Error querying Pinecone:', { error });
    throw error;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { GoogleGenerativeAIEmbeddings } = await import('@langchain/google-genai');

    const embeddings = new GoogleGenerativeAIEmbeddings({
      modelName: 'text-embedding-004',
      apiKey: ENV.GOOGLE_GEMINI_API_KEY,
    });

    const result = await embeddings.embedQuery(text);

    return result;
  } catch (error) {
    logger.error('Error generating embedding:', { error });
    throw error;
  }
}
