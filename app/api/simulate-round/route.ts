import { NextRequest } from 'next/server';
import { 
  runSingleRound, 
  generateImprovedSystemPrompt,
  generateRedAgentSystemPrompt,
} from '@/scripts/shared';
import type { SingleRoundEvent, PreviousRoundSummary, RoundContext } from '@/scripts/shared';

/**
 * POST /api/simulate-round
 * 
 * Ejecuta UNA sola ronda de evaluación multi-ronda.
 * Esto permite pausar entre rondas para que el usuario pueda editar el prompt.
 * 
 * Request body:
 * - systemPrompt?: string - El prompt del Red Agent (si no se proporciona, se genera)
 * - evaluationPrompt: string - El objetivo de evaluación del usuario
 * - turnsPerRound: number - Número de turnos en esta ronda
 * - roundNumber: number - Número de ronda actual (1-based)
 * - totalRounds: number - Total de rondas configuradas
 * - previousRounds?: PreviousRoundSummary[] - Resumen de rondas anteriores (para generar mejoras)
 * 
 * SSE Events emitidos:
 * - round_start: Inicio de la ronda
 * - message: Cada mensaje de la conversación
 * - round_evaluating: Cuando empieza la evaluación
 * - round_complete: Resultado de la ronda
 * - next_prompt_ready: Prompt mejorado para la siguiente ronda (si no es la última)
 * - all_rounds_complete: Cuando es la última ronda
 * - error: En caso de error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      systemPrompt: providedSystemPrompt,
      evaluationPrompt, 
      turnsPerRound, 
      roundNumber,
      totalRounds,
      previousRounds = [],
    } = body;

    // Validaciones
    if (!evaluationPrompt || typeof evaluationPrompt !== 'string') {
      return new Response(JSON.stringify({ error: 'evaluationPrompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!roundNumber || roundNumber < 1) {
      return new Response(JSON.stringify({ error: 'roundNumber must be >= 1' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!totalRounds || totalRounds < 1) {
      return new Response(JSON.stringify({ error: 'totalRounds must be >= 1' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const turns = turnsPerRound || 10;
    const isLastRound = roundNumber >= totalRounds;

    // Track if client disconnects
    let isCancelled = false;

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: SingleRoundEvent) => {
          if (!isCancelled) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            } catch (e) {
              isCancelled = true;
            }
          }
        };

        try {
          // Determinar el system prompt a usar
          let systemPrompt = providedSystemPrompt;
          
          if (!systemPrompt) {
            // Si es la primera ronda, generar prompt inicial
            if (roundNumber === 1) {
              systemPrompt = await generateRedAgentSystemPrompt(evaluationPrompt);
            } else {
              // Si hay rondas anteriores, generar prompt mejorado
              const roundContext: RoundContext = {
                roundNumber,
                previousRounds: previousRounds as PreviousRoundSummary[],
              };
              systemPrompt = await generateImprovedSystemPrompt(evaluationPrompt, roundContext);
            }
          }

          if (isCancelled) return;

          // Emit round start
          sendEvent({
            type: 'round_start',
            roundNumber,
            systemPrompt,
          });

          // Run the single round
          const roundResult = await runSingleRound(
            systemPrompt,
            evaluationPrompt,
            turns,
            roundNumber,
            undefined, // greenAgentRules
            (event) => {
              // Forward multi-round events as single-round events
              if (event.type === 'message') {
                sendEvent({
                  type: 'message',
                  roundNumber: event.roundNumber,
                  turn: event.turn,
                  message: event.message,
                });
              } else if (event.type === 'round_evaluating') {
                sendEvent({
                  type: 'round_evaluating',
                  roundNumber: event.roundNumber,
                });
              }
            },
            () => isCancelled
          );

          if (isCancelled) return;

          // If not the last round, emit round_complete and generate next prompt
          if (!isLastRound) {
            // Emit round complete
            sendEvent({
              type: 'round_complete',
              roundNumber,
              result: roundResult,
            });

            // Build context including this round
            const allPreviousRounds: PreviousRoundSummary[] = [
              ...previousRounds,
              {
                roundNumber: roundResult.roundNumber,
                score: roundResult.evaluation.successScore,
                outcome: roundResult.evaluation.outcome,
                summary: roundResult.evaluation.summary,
                detailedAnalysis: roundResult.evaluation.detailedAnalysis,
                effectiveTactics: roundResult.evaluation.effectiveTactics,
                keyVulnerabilities: roundResult.evaluation.keyVulnerabilities,
              },
            ];

            const nextRoundContext: RoundContext = {
              roundNumber: roundNumber + 1,
              previousRounds: allPreviousRounds,
            };

            if (isCancelled) return;

            // Generate improved prompt for next round
            const nextPrompt = await generateImprovedSystemPrompt(
              evaluationPrompt,
              nextRoundContext
            );

            if (isCancelled) return;

            // Emit next prompt ready
            sendEvent({
              type: 'next_prompt_ready',
              nextRoundNumber: roundNumber + 1,
              nextPrompt,
            });
          } else {
            // This was the last round - only emit all_rounds_complete (not round_complete)
            sendEvent({
              type: 'all_rounds_complete',
              roundNumber,
              result: roundResult,
            });
          }
        } catch (error: any) {
          if (!isCancelled) {
            if (error.message === 'CANCELLED') {
              // User cancelled, just close
            } else {
              sendEvent({ type: 'error', message: error.message });
            }
          }
        } finally {
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        }
      },
      cancel() {
        isCancelled = true;
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error in simulate-round:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
