/**
 * Tipos compartidos para la simulación de agentes
 */

export type AgentRole = 'red-agent' | 'green-agent';

export interface Message {
  role: AgentRole;
  content: string;
  timestamp: Date;
  turnNumber: number;
}

export interface ConversationContext {
  messages: Message[];
  currentTurn: number;
  maxTurns: number;
}

export interface AgentResponse {
  content: string;
  metadata?: {
    manipulationTactic?: 'emotional' | 'legal' | 'technical' | 'mixed' | 'none';
    confidence?: number;
  };
}

export interface TacticCounts {
  emotional: number;
  legal: number;
  technical: number;
}

/**
 * Configuración para el Purple Agent (orquestador/evaluador)
 */
export interface PurpleAgentConfig {
  evaluationPrompt: string; // El prompt de evaluación definido por el usuario
  maxTurns?: number; // Número máximo de turnos (default: 10)
  greenAgentRules?: string; // Reglas personalizadas para el Green Agent (opcional)
}

/**
 * Resultado de la evaluación del Purple Agent
 */
export interface EvaluationResult {
  outcome: 'total_success' | 'partial_success' | 'failure';
  successScore: number; // 0-100
  authorizationDecision: 'approved' | 'denied' | 'pending' | 'unclear';
  keyVulnerabilities: string[];
  effectiveTactics: string[];
  summary: string;
  detailedAnalysis: string;
}

/**
 * Resultado completo de la simulación
 */
export interface SimulationResult {
  messages: Message[];
  totalTurns: number;
  tacticCounts: TacticCounts;
  evaluation: EvaluationResult;
  redAgentSystemPrompt: string; // System prompt generado para el Red Agent
}

/**
 * Configuración del Red Agent generado por Purple Agent
 */
export interface RedAgentConfig {
  systemPrompt: string;
  attackStrategy: string;
  phases: {
    phase1: string;
    phase2: string;
    phase3: string;
    phase4: string;
  };
}

// ============================================================
// MULTI-ROUND EVALUATION TYPES
// ============================================================

/**
 * Resultado de una ronda individual en una evaluación multi-ronda
 */
export interface RoundResult {
  roundNumber: number;
  systemPrompt: string;
  messages: Message[];
  tacticCounts: TacticCounts;
  evaluation: EvaluationResult;
}

/**
 * Contexto pasado entre rondas para que Purple Agent mejore la estrategia
 */
export interface RoundContext {
  roundNumber: number;
  previousRounds: {
    roundNumber: number;
    score: number;
    outcome: EvaluationResult['outcome'];
    summary: string;
    detailedAnalysis: string;
    effectiveTactics: string[];
    keyVulnerabilities: string[];
  }[];
}

/**
 * Configuración para evaluación multi-ronda
 */
export interface MultiRoundConfig {
  evaluationPrompt: string;
  totalRounds: number;
  turnsPerRound: number;
  greenAgentRules?: string;
}

/**
 * Resultado completo de una evaluación multi-ronda
 */
export interface MultiRoundResult {
  config: MultiRoundConfig;
  rounds: RoundResult[];
  bestRound: RoundResult;
  worstRound: RoundResult;
  scoreProgression: number[];
  completed: boolean;
  stoppedAtRound?: number;
}

/**
 * Eventos emitidos durante una evaluación multi-ronda (para streaming)
 */
export type MultiRoundEvent =
  | { type: 'round_start'; roundNumber: number; totalRounds: number; systemPrompt: string }
  | { type: 'message'; roundNumber: number; turn: number; message: Message }
  | { type: 'round_evaluating'; roundNumber: number }
  | { type: 'round_complete'; roundNumber: number; result: RoundResult }
  | { type: 'generating_next_strategy'; roundNumber: number; context: RoundContext }
  | { type: 'next_prompt_ready'; roundNumber: number; nextPrompt: string; context: RoundContext }
  | { type: 'complete'; result: MultiRoundResult }
  | { type: 'stopped'; result: MultiRoundResult; reason: 'user_cancelled' }
  | { type: 'error'; message: string };

/**
 * Eventos emitidos durante una ronda individual (para API por ronda)
 */
export type SingleRoundEvent =
  | { type: 'round_start'; roundNumber: number; systemPrompt: string }
  | { type: 'message'; roundNumber: number; turn: number; message: Message }
  | { type: 'round_evaluating'; roundNumber: number }
  | { type: 'round_complete'; roundNumber: number; result: RoundResult }
  | { type: 'next_prompt_ready'; nextRoundNumber: number; nextPrompt: string }
  | { type: 'all_rounds_complete'; roundNumber: number; result: RoundResult }
  | { type: 'error'; message: string };

/**
 * Resumen de ronda anterior para usar en generación de siguiente prompt
 */
export interface PreviousRoundSummary {
  roundNumber: number;
  score: number;
  outcome: EvaluationResult['outcome'];
  summary: string;
  detailedAnalysis: string;
  effectiveTactics: string[];
  keyVulnerabilities: string[];
}
