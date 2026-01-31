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
  // Multi-round types
  RoundResult,
  RoundContext,
  MultiRoundConfig,
  MultiRoundResult,
  MultiRoundEvent,
  SingleRoundEvent,
  PreviousRoundSummary,
  RoundSuggestions,
} from './types';

// ============================================================
// 🟣 PURPLE AGENT - Orquestador y Evaluador
// ============================================================
export {
  createPurpleAgent,
  runQuickSimulation,
  evaluateConversation,
  generateRedAgentSystemPrompt,
  generateImprovementSuggestions,
} from './purple-agent';

export type { PromptSuggestions, SuggestionInput } from './purple-agent';

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
  getDefaultGreenAgentPrompt,
} from './green-agent';

export type { DbChangeTrackingContext } from './green-agent';

// ============================================================
// 🔄 MULTI-ROUND EVALUATION - Evaluación Iterativa
// ============================================================
export {
  runMultiRoundEvaluation,
  createMultiRoundConfig,
  // Funciones para evaluación por ronda individual (con pausa entre rondas)
  runSingleRound,
  generateImprovedSystemPrompt,
  evaluateConversation as evaluateMultiRoundConversation,
} from './multi-round';
