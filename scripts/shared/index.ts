/**
 * MedBreaker - Agent Security Testing Framework
 * 
 * Exporta todas las funciones y tipos necesarios para crear
 * simulaciones de Red Team vs sistemas de autorización médica.
 * 
 * Arquitectura de 3 Agentes:
 * 
 *   🟣 Purple Agent (Orquestador/Evaluador)
 *       ↓
 *   Crea y configura ↓
 *       ↓
 *   🔴 Red Agent ↔️ 🟢 Green Agent
 *   (Atacante)       (Defensor)
 *       ↓
 *   Evalúa resultado
 *       ↓
 *   📊 Score + Análisis
 */

// ============================================================
// TIPOS
// ============================================================
export type {
  AgentRole,
  Message,
  ConversationContext,
  AgentResponse,
  TacticCounts,
  PurpleAgentConfig,
  EvaluationResult,
  SimulationResult,
  RedAgentConfig,
} from './types';

// ============================================================
// 🟣 PURPLE AGENT - Orquestador y Evaluador
// ============================================================
export {
  createPurpleAgent,
  runQuickSimulation,
  evaluateConversation,
} from './purple-agent';

// ============================================================
// 🔴 RED AGENT - Atacante
// ============================================================
export {
  createRedAgent,
  generateRedAgentMessage,
  getDefaultRedAgentPrompt,
} from './red-agent';

// ============================================================
// 🟢 GREEN AGENT - Defensor
// ============================================================
export {
  createGreenAgent,
  generateGreenAgentResponse,
  loadRules,
  createGreenAgentSystemPrompt,
} from './green-agent';
