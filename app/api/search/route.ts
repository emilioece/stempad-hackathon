import { prisma } from '@/app/lib/db';
import { getSession } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    // Get user's notes
    const notes = await prisma.note.findMany({
      where: { userId: session.user.sub },
      select: {
        id: true,
        notes: true,
        transcript: true,
        createdAt: true,
        timestamp: true,
      },
    });

    // Generate embeddings for the search query
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });
    const queryEmbedding = response.data[0].embedding;

    // For each note, calculate similarity with query
    const notesWithScores = await Promise.all(notes.map(async (note) => {
      const noteText = `${note.notes}\n${note.transcript}`;
      const noteEmbedding = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: noteText,
      });
      
      // Calculate cosine similarity
      const similarity = cosineSimilarity(queryEmbedding, noteEmbedding.data[0].embedding);
      
      return {
        ...note,
        score: similarity,
      };
    }));

    // Sort by similarity score and return top results
    const searchResults = notesWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json(searchResults);
  } catch (error) {
    console.error('Error searching notes:', error);
    return NextResponse.json({ error: 'Failed to search notes' }, { status: 500 });
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
} 