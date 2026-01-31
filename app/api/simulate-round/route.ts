import { NextRequest } from 'next/server';
import { 
  runSingleRound, 
  generateImprovedSystemPrompt,
  generateRedAgentSystemPrompt,
  generateImprovementSuggestions,
} from '@/scripts/shared';
import type { SingleRoundEvent, PreviousRoundSummary, RoundContext, RoundSuggestions } from '@/scripts/shared';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

// Get Convex URL from environment
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

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
 * - evaluationId?: string - ID de evaluación existente en Convex (para multi-round)
 * 
 * SSE Events emitidos:
 * - evaluation_created: Cuando se crea la evaluación en Convex (solo ronda 1)
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
      evaluationId: providedEvaluationId,
      greenAgentPrompt, // Custom Green Agent prompt
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

    // Initialize Convex client
    const convex = CONVEX_URL ? new ConvexHttpClient(CONVEX_URL) : null;

    // Track if client disconnects
    let isCancelled = false;

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let evaluationId = providedEvaluationId || null;

        const sendEvent = (event: SingleRoundEvent | { type: 'evaluation_created'; evaluationId: string }) => {
          if (!isCancelled) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            } catch (e) {
              isCancelled = true;
            }
          }
        };

        try {
          // Create evaluation record in Convex for first round (if not provided)
          if (convex && roundNumber === 1 && !evaluationId) {
            try {
              evaluationId = await convex.mutation(api.evaluations.create, {
                type: 'multi',
                evaluationPrompt,
                turnsPerRound: turns,
                totalRounds,
              });
              sendEvent({ type: 'evaluation_created', evaluationId });
            } catch (e) {
              console.error('Failed to create evaluation in Convex:', e);
              // Continue without persistence
            }
          }

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
            greenAgentPrompt || undefined, // Custom Green Agent prompt or undefined for default
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
            () => isCancelled,
            CONVEX_URL, // Pass Convex URL to enable tools
            evaluationId || undefined, // Pass evaluationId for DB change tracking
            !!greenAgentPrompt // isFullGreenPrompt = true if custom prompt provided
          );

          if (isCancelled) {
            // Mark evaluation as cancelled in Convex
            if (convex && evaluationId) {
              try {
                await convex.mutation(api.evaluations.cancel, {
                  id: evaluationId as any,
                });
              } catch (e) {
                console.error('Failed to cancel evaluation in Convex:', e);
              }
            }
            return;
          }

          // Save round to Convex
          if (convex && evaluationId) {
            try {
              // Convert messages for Convex storage
              const messagesForConvex = roundResult.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
                turnNumber: msg.turnNumber,
                timestamp: msg.timestamp.getTime(),
                toolCalls: msg.toolCalls?.map((tc) => ({
                  tool: tc.tool,
                  args: tc.args,
                  result: tc.result,
                })),
              }));

              await convex.mutation(api.evaluations.addRound, {
                id: evaluationId as any,
                round: {
                  roundNumber: roundResult.roundNumber,
                  systemPrompt: roundResult.systemPrompt,
                  messages: messagesForConvex,
                  tacticCounts: roundResult.tacticCounts,
                  evaluation: roundResult.evaluation,
                },
              });
            } catch (e) {
              console.error('Failed to save round to Convex:', e);
            }
          }

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

            // Emit next prompt ready (include evaluationId for subsequent rounds)
            sendEvent({
              type: 'next_prompt_ready',
              nextRoundNumber: roundNumber + 1,
              nextPrompt,
            });

            // Generate improvement suggestions for both agents
            try {
              const suggestions = await generateImprovementSuggestions({
                messages: roundResult.messages,
                evaluation: roundResult.evaluation,
                greenAgentPrompt: greenAgentPrompt || undefined,
                redAgentPrompt: systemPrompt,
                evaluationPrompt,
              });

              if (isCancelled) return;

              // Emit suggestions ready
              sendEvent({
                type: 'suggestions_ready',
                suggestions: suggestions as RoundSuggestions,
              });
            } catch (suggestionError) {
              console.error('Failed to generate suggestions:', suggestionError);
              // Don't fail the whole flow if suggestions fail
            }
          } else {
            // This was the last round - complete the evaluation in Convex
            if (convex && evaluationId) {
              try {
                await convex.mutation(api.evaluations.complete, {
                  id: evaluationId as any,
                });
              } catch (e) {
                console.error('Failed to complete evaluation in Convex:', e);
              }
            }

            // Emit all_rounds_complete (not round_complete)
            sendEvent({
              type: 'all_rounds_complete',
              roundNumber,
              result: roundResult,
            });
          }
        } catch (error: any) {
          if (!isCancelled) {
            if (error.message === 'CANCELLED') {
              // User cancelled
              if (convex && evaluationId) {
                try {
                  await convex.mutation(api.evaluations.cancel, {
                    id: evaluationId as any,
                  });
                } catch (e) {
                  console.error('Failed to cancel evaluation in Convex:', e);
                }
              }
            } else {
              // Mark evaluation as failed
              if (convex && evaluationId) {
                try {
                  await convex.mutation(api.evaluations.fail, {
                    id: evaluationId as any,
                    errorMessage: error.message,
                  });
                } catch (e) {
                  console.error('Failed to mark evaluation as failed:', e);
                }
              }
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
