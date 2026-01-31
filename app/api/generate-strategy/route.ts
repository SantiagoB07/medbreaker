import { NextRequest, NextResponse } from 'next/server';
import { generateRedAgentSystemPrompt } from '@/scripts/shared';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { evaluationPrompt } = body;

    if (!evaluationPrompt || typeof evaluationPrompt !== 'string') {
      return NextResponse.json(
        { error: 'evaluationPrompt is required' },
        { status: 400 }
      );
    }

    const systemPrompt = await generateRedAgentSystemPrompt(evaluationPrompt);

    return NextResponse.json({ systemPrompt });
  } catch (error: any) {
    console.error('Error generating strategy:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate strategy' },
      { status: 500 }
    );
  }
}
