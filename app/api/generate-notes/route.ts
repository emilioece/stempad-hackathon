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

    const prompt = `Given the current transcript: ${transcript}, 
    return me some notes and give it a title. Always write the title with one markdown #.
    Do not include the original transcript in your return.
    Also only summarize what is given based in the transcript.`
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: prompt
        },
        // {
        //   role: "user",
        //   content: transcript
        // }
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
