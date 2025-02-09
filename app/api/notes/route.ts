import { prisma } from '@/app/lib/db';
import { getSession } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

async function ensureUser(userId: string, email: string) {
  try {
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: { email },
      create: {
        id: userId,
        email,
      },
    });
    return user;
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    throw error;
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureUser(session.user.sub, session.user.email);
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || session.user.sub;

    const notes = await prisma.note.findMany({
      where: { userId: userId as string },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureUser(session.user.sub, session.user.email);
    
    const data = await request.json();
    const note = await prisma.note.create({
      data: {
        transcript: data.transcript,
        notes: data.notes,
        userId: session.user.sub,
        title: data.title || 'Untitled Note',
      },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
} 