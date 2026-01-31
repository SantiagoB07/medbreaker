import dotenv from 'dotenv';
import { generateRedAgentMessage } from './shared/red-agent';
import { generateAuthResponse } from './shared/auth-agent';
import { evaluateSimulation } from './shared/evaluator-agent';
import type { ConversationContext, Message, TacticCounts, EvaluationResult } from './shared/types';

/**
 * Simulación de Red Team vs Authorization Agent
 * Los dos agentes interactúan automáticamente
 */

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

// Verificar API key
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY no está configurada en .env.local');
  console.error('Por favor, añade tu API key de OpenAI al archivo .env.local');
  process.exit(1);
}

const MAX_TURNS = 10;

/**
 * Función principal de simulación
 */
async function runSimulation() {
  console.log('\n🔴⚔️  RED TEAM vs AUTHORIZATION AGENT SIMULATION ⚔️🏥');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('⏳ Generando conversación completa...');
  console.log('   (Esto puede tomar 60-90 segundos)\n');

  // Inicializar contexto
  const context: ConversationContext = {
    messages: [],
    currentTurn: 0,
    maxTurns: MAX_TURNS,
  };

  // Contador de tácticas
  const tacticCounts: TacticCounts = {
    emotional: 0,
    legal: 0,
    technical: 0,
  };

  try {
    // Loop de conversación
    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      context.currentTurn = turn;

      const isRedAgentTurn = turn % 2 === 1; // Turnos impares = Red Agent

      if (isRedAgentTurn) {
        // Turno del Red Agent
        process.stdout.write(`   🔴 Generando mensaje Red Agent (turno ${turn}/${MAX_TURNS})...\r`);
        
        const response = await generateRedAgentMessage(context);
        
        const message: Message = {
          role: 'red-agent',
          content: response.content,
          timestamp: new Date(),
          turnNumber: turn,
        };

        context.messages.push(message);

        // Contar tácticas
        if (response.metadata?.manipulationTactic) {
          const tactic = response.metadata.manipulationTactic;
          if (tactic === 'emotional') tacticCounts.emotional++;
          else if (tactic === 'legal') tacticCounts.legal++;
          else if (tactic === 'technical') tacticCounts.technical++;
          else if (tactic === 'mixed') {
            tacticCounts.emotional++;
            tacticCounts.legal++;
          }
        }
      } else {
        // Turno del Authorization Agent
        process.stdout.write(`   🏥 Generando respuesta Auth Agent (turno ${turn}/${MAX_TURNS})...\r`);
        
        const lastMessage = context.messages[context.messages.length - 1];
        const response = await generateAuthResponse(context, lastMessage.content);
        
        const message: Message = {
          role: 'auth-agent',
          content: response.content,
          timestamp: new Date(),
          turnNumber: turn,
        };

        context.messages.push(message);
      }
    }

    // Limpiar línea de progreso
    process.stdout.write('                                                                    \r');

    console.log('✅ Conversación completada!\n');

    // Mostrar conversación
    displayConversation(context.messages);

    // Evaluar con Evaluator Agent
    console.log('🔍 Analizando conversación con Evaluator Agent...\n');
    
    const evaluation = await evaluateSimulation(context.messages, tacticCounts);
    
    // Mostrar resultados de la evaluación
    displayEvaluationResults(context.messages, tacticCounts, evaluation);

  } catch (error: any) {
    console.error('\n❌ Error durante la simulación:', error.message);
    console.error('Detalle:', error);
    process.exit(1);
  }
}

/**
 * Muestra la conversación completa
 */
function displayConversation(messages: Message[]) {
  console.log('📊 REGISTRO DE CONVERSACIÓN');
  console.log('═══════════════════════════════════════════════════════════\n');

  messages.forEach((msg) => {
    const icon = msg.role === 'red-agent' ? '🔴' : '🏥';
    const label = msg.role === 'red-agent' ? 'RED AGENT' : 'AUTHORIZATION AGENT';
    const color = msg.role === 'red-agent' ? '\x1b[31m' : '\x1b[36m'; // Rojo o Cyan
    const reset = '\x1b[0m';

    console.log(`${color}[Turno ${msg.turnNumber}] ${icon} ${label}:${reset}`);
    console.log('─────────────────────────────────────────────────────────');
    console.log(msg.content);
    console.log('─────────────────────────────────────────────────────────\n');
  });
}

/**
 * Muestra los resultados de la evaluación
 */
function displayEvaluationResults(
  messages: Message[],
  tacticCounts: TacticCounts,
  evaluation: EvaluationResult
) {
  console.log('\n📈 EVALUACIÓN DEL EVALUATOR AGENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`✅ Conversación completada: ${messages.length} turnos\n`);

  console.log('🎯 Tácticas de manipulación utilizadas:');
  console.log(`   • Emocionales: ${tacticCounts.emotional}`);
  console.log(`   • Legales: ${tacticCounts.legal}`);
  console.log(`   • Técnicas: ${tacticCounts.technical}\n`);

  // Resultado del ataque
  const outcomeConfig = {
    total_success: {
      emoji: '🎯',
      label: 'ÉXITO TOTAL',
      color: '\x1b[31m', // Rojo (peligro)
    },
    partial_success: {
      emoji: '⚠️',
      label: 'ÉXITO PARCIAL',
      color: '\x1b[33m', // Amarillo (advertencia)
    },
    failure: {
      emoji: '🛡️',
      label: 'FRACASO',
      color: '\x1b[32m', // Verde (seguro)
    },
  };

  const config = outcomeConfig[evaluation.outcome];
  const reset = '\x1b[0m';

  console.log(`${config.color}${config.emoji} RESULTADO DEL ATAQUE: ${config.label}${reset}`);
  console.log(`   Score de manipulación: ${evaluation.successScore}/100\n`);

  // Decisión de autorización
  const decisionEmoji = {
    approved: '✅',
    denied: '❌',
    pending: '⏳',
    unclear: '❓',
  };

  const decisionLabel = {
    approved: 'APROBADO',
    denied: 'DENEGADO',
    pending: 'PENDIENTE',
    unclear: 'NO CLARO',
  };

  console.log(
    `${decisionEmoji[evaluation.authorizationDecision]} Decisión de autorización: ${
      decisionLabel[evaluation.authorizationDecision]
    }\n`
  );

  // Vulnerabilidades
  if (evaluation.keyVulnerabilities.length > 0) {
    console.log('⚠️  Vulnerabilidades Explotadas:');
    evaluation.keyVulnerabilities.forEach((vuln) => {
      console.log(`   • ${vuln}`);
    });
    console.log('');
  } else {
    console.log('🛡️  No se detectaron vulnerabilidades explotadas.\n');
  }

  // Tácticas efectivas
  if (evaluation.effectiveTactics.length > 0) {
    console.log('✅ Tácticas Efectivas:');
    evaluation.effectiveTactics.forEach((tactic) => {
      console.log(`   • ${tactic}`);
    });
    console.log('');
  }

  // Resumen
  console.log('📝 Resumen:');
  console.log('─────────────────────────────────────────────────────────');
  console.log(evaluation.summary);
  console.log('─────────────────────────────────────────────────────────\n');

  // Análisis detallado
  console.log('🔍 Análisis Detallado:');
  console.log('─────────────────────────────────────────────────────────');
  console.log(evaluation.detailedAnalysis);
  console.log('─────────────────────────────────────────────────────────\n');

  console.log('💡 Nota: Esta evaluación fue realizada por un agente de IA');
  console.log('   independiente que analizó toda la conversación.\n');
}

/**
 * Manejo de señales para terminar limpiamente
 */
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Simulación interrumpida por el usuario.');
  console.log('👋 Finalizando...\n');
  process.exit(0);
});

// Ejecutar simulación
runSimulation().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
