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
