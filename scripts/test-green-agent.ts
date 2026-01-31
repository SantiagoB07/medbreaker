/**
 * Test script for Green Agent with AI SDK tools
 * Run with: npx tsx scripts/test-green-agent.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { generateText, tool, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://joyous-retriever-30.convex.cloud';

async function testGreenAgentTools() {
  console.log('🧪 Testing Green Agent with AI SDK Tools\n');
  console.log('Convex URL:', CONVEX_URL);
  
  const convex = new ConvexHttpClient(CONVEX_URL);

  // Create simple tools
  const tools = {
    searchProcedures: tool({
      description: 'Search the medical procedures database by name, category, or keywords.',
      inputSchema: z.object({
        query: z.string().describe('Search term'),
      }),
      execute: async ({ query }) => {
        console.log('\n🔧 Tool called: searchProcedures');
        console.log('   Input:', { query });
        
        try {
          const results = await convex.query(api.procedures.search, { query });
          console.log('   Convex returned:', results?.length, 'results');
          
          if (!results || results.length === 0) {
            const response = {
              found: false,
              message: `No procedures found matching "${query}"`,
              procedures: [],
            };
            console.log('   Returning:', JSON.stringify(response));
            return response;
          }
          
          const response = {
            found: true,
            count: results.length,
            procedures: results.map((p: any) => ({
              id: p._id,
              name: p.name,
              nameEs: p.nameEs,
              category: p.category,
              requiresPreAuth: p.requiresPreAuth,
              conditions: p.conditions,
              isExcluded: p.isExcluded,
            })),
          };
          console.log('   Returning:', JSON.stringify(response).substring(0, 200) + '...');
          return response;
        } catch (error) {
          console.error('   Error:', error);
          return { found: false, error: 'Database search failed', procedures: [] };
        }
      },
    }),
  };

  const systemPrompt = `Eres un sistema de autorización médica. 
Tienes acceso a la herramienta searchProcedures para buscar procedimientos en la base de datos.
SIEMPRE usa la herramienta para verificar procedimientos antes de responder.`;

  const userMessage = 'I need authorization for an MRI scan of my knee.';

  console.log('\n--- Sending to model ---');
  console.log('System:', systemPrompt.substring(0, 100) + '...');
  console.log('User:', userMessage);
  console.log('\n--- Calling generateText ---');

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: tools,
      stopWhen: stepCountIs(5),
    });

    console.log('\n--- Result ---');
    console.log('Text:', result.text);
    console.log('Finish reason:', result.finishReason);
    console.log('Steps count:', result.steps?.length);
    
    if (result.steps) {
      console.log('\n--- Steps detail ---');
      for (let i = 0; i < result.steps.length; i++) {
        const step = result.steps[i];
        console.log(`\nStep ${i + 1}:`);
        console.log('  Text:', step.text?.substring(0, 100) || '(none)');
        console.log('  Tool calls:', step.toolCalls?.length || 0);
        console.log('  Tool results:', step.toolResults?.length || 0);
        
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const tc of step.toolCalls) {
            console.log('    Tool call:', tc.toolName);
            console.log('    Input:', JSON.stringify(tc.input));
          }
        }
        
        if (step.toolResults && step.toolResults.length > 0) {
          for (const tr of step.toolResults) {
            console.log('    Tool result:', JSON.stringify(tr.output)?.substring(0, 200));
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n✅ Test completed');
}

testGreenAgentTools().catch(console.error);
