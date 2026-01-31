import { NextResponse } from 'next/server';
import { getDefaultGreenAgentPrompt } from '@/scripts/shared';

/**
 * GET /api/green-agent-template
 * 
 * Retorna el system prompt por defecto del Green Agent (vulnerable)
 * Útil para mostrar el template en la UI de configuración
 */
export async function GET() {
  try {
    const defaultPrompt = getDefaultGreenAgentPrompt();
    
    return NextResponse.json({
      prompt: defaultPrompt,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting Green Agent template:', errorMessage);
    
    return NextResponse.json(
      { error: 'Failed to get Green Agent template' },
      { status: 500 }
    );
  }
}
