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

    const example_note = `# Introduction to the Internet

    ## What is the Internet?
    - **Infrastructure** for transferring data between devices globally
    - **Not the same** as the World Wide Web
    - Web = applications built on top of the Internet (e.g., Facebook, Twitter)
    - Other apps use the Internet too (e.g., Zoom, online games, IoT devices)

    ## Why is the Internet Interesting?
    - **New problem**: Tying together different, existing networks
    - **Challenges**:
    - No formal model
    - No measurable performance benchmark
    - Must scale to **billions** of users
    - Must align with business relationships

    ## The Internet is Federated
    - **Federated system**: Requires interoperability between operators
    - **Challenges**:
    - Competing entities forced to cooperate
    - Complicates innovation (need common protocols)

    ## Key Considerations
    1. **Asynchronous operation**
    - Data can't move faster than light
    - Messages may be outdated upon arrival
    2. **Designed for failure at scale**
    - Multiple components involved in sending a message
    - Components can fail without immediate detection

    **Note**: Many Internet design ideas have been adopted in other fields`;

    const prompt = `Given the current transcript: ${transcript}, 
    return me some notes based on the below example: ${example_note}. 
    Do not include the original transcript in your return.
    Also only summarize what is given based in the transcript. 
    Adding details you know are for sure right and relevant is fine, but keep it on point.`;
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
