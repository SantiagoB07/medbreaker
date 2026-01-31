import { NextRequest, NextResponse } from 'next/server';
import { 
  generateImprovementSuggestions, 
  type SuggestionInput 
} from '@/scripts/shared/purple-agent';

/**
 * POST /api/suggest-improvements
 * 
 * El Purple Agent analiza la conversación y genera sugerencias de mejora
 * tanto para el Green Agent (defensa) como para el Red Agent (ataque).
 * 
 * Request body:
 * - messages: Array de mensajes de la conversación
 * - evaluation: Resultado de la evaluación
 * - greenAgentPrompt: Prompt original del Green Agent
 * - redAgentPrompt: Prompt original del Red Agent
 * - evaluationPrompt: Objetivo de evaluación del usuario
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      messages, 
      evaluation, 
      greenAgentPrompt, 
      redAgentPrompt,
      evaluationPrompt,
    } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      );
    }

    if (!evaluation) {
      return NextResponse.json(
        { error: 'evaluation is required' },
        { status: 400 }
      );
    }

    // Build input for the Purple Agent
    const input: SuggestionInput = {
      messages,
      evaluation,
      greenAgentPrompt,
      redAgentPrompt,
      evaluationPrompt,
    };

    // Generate improvements using the shared Purple Agent logic
    const suggestions = await generateImprovementSuggestions(input);

    return NextResponse.json(suggestions);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating improvements:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to generate improvement suggestions' },
      { status: 500 }
    );
  }
}
