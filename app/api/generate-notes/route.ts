import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert note-taker for university office hours. 
            Create clear, structured notes from the transcript provided. 
            Focus on:
            - Main topics discussed
            - Key concepts and definitions
            - Important examples
            - Action items or homework-related information
            Format the notes in a clear, hierarchical structure.`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const generatedNotes = completion.choices[0].message.content;

    return NextResponse.json({
      notes: generatedNotes,
    });
    
  } catch (error) {
    console.error('Error processing transcript:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate notes' },
      { status: 500 }
    );
  }
}
