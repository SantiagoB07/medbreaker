import { NextRequest } from 'next/server';
import { runMultiRoundEvaluation, createMultiRoundConfig } from '@/scripts/shared';
import type { MultiRoundEvent } from '@/scripts/shared';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { evaluationPrompt, totalRounds, turnsPerRound } = body;

    if (!evaluationPrompt || typeof evaluationPrompt !== 'string') {
      return new Response(JSON.stringify({ error: 'evaluationPrompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rounds = totalRounds || 3;
    const turns = turnsPerRound || 10;

    // Create config
    const config = createMultiRoundConfig(evaluationPrompt, rounds, turns);

    // Track if client disconnects
    let isCancelled = false;

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: MultiRoundEvent) => {
          if (!isCancelled) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            } catch (e) {
              // Controller might be closed
              isCancelled = true;
            }
          }
        };

        try {
          await runMultiRoundEvaluation(
            config,
            sendEvent,
            () => isCancelled
          );
        } catch (error: any) {
          if (!isCancelled) {
            sendEvent({ type: 'error', message: error.message });
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
    console.error('Error in simulate-multi:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
