// Re-export types for client-side usage
export type AgentRole = 'red-agent' | 'green-agent';

/**
 * Representa una llamada a tool hecha por el agente
 */
export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface Message {
  role: AgentRole;
  content: string;
  timestamp: Date;
  turnNumber: number;
  toolCalls?: ToolCall[];
}

export interface TacticCounts {
  emotional: number;
  legal: number;
  technical: number;
}

export interface EvaluationResult {
  outcome: 'total_success' | 'partial_success' | 'failure';
  successScore: number;
  authorizationDecision: 'approved' | 'denied' | 'pending' | 'unclear';
  keyVulnerabilities: string[];
  effectiveTactics: string[];
  summary: string;
  detailedAnalysis: string;
}

/**
 * Representa un cambio en la base de datos hecho por el Green Agent
 * Estos cambios son vulnerabilidades críticas
 */
export interface DbChange {
  action: 'create' | 'update' | 'delete';
  procedureId?: string;
  procedureName: string;
  roundNumber: number;
  timestamp: number;
}

// Dashboard specific types
export type EvaluationState = 
  | 'configuring'           // User entering evaluation prompt + turns
  | 'generating'            // Generating Red Agent strategy
  | 'preview'               // Showing strategy, user can edit
  | 'simulating'            // Running simulation
  | 'evaluating'            // Purple Agent evaluating
  | 'waiting_for_continue'  // Multi-round: waiting for user to review/edit prompt and continue
  | 'results';              // Showing final results

export interface SimulationConfig {
  evaluationPrompt: string;
  maxTurns: number;
  systemPrompt: string;  // Red Agent system prompt
  greenAgentPrompt?: string;  // Green Agent system prompt (defensor)
}

/**
 * Sugerencias de mejora generadas por el Purple Agent
 */
export interface PromptSuggestions {
  greenAgentImproved: string;  // Prompt mejorado para fortalecer la defensa
  redAgentImproved: string;    // Prompt mejorado para ataques más efectivos
  analysisGreen: string;       // Análisis de por qué el Green cedió
  analysisRed: string;         // Análisis de qué funcionó en el ataque
}

// Multi-evaluation support
export interface Evaluation {
  id: string;
  state: EvaluationState;
  config: SimulationConfig;
  messages: Message[];
  currentTurn: number;
  evaluation: EvaluationResult | null;
  tacticCounts: TacticCounts | null;
  error: string | null;
  createdAt: Date;
  // Multi-round support
  isMultiRound: boolean;
  multiRoundConfig?: MultiRoundConfig;
  rounds?: RoundResult[];
  currentRound?: number;
  scoreProgression?: number[];
  // Multi-round with pause: pending prompt for next round
  pendingNextPrompt?: string;
  // Pending suggestions for current round (shown between rounds)
  pendingSuggestions?: PromptSuggestions;
  // Loading state for suggestions generation
  isLoadingSuggestions?: boolean;
  // Track previous rounds summaries for API calls
  previousRoundsSummary?: PreviousRoundSummary[];
  // DB changes made by Green Agent (vulnerability tracking)
  dbChanges?: DbChange[];
  // Prompt improvement suggestions from Purple Agent
  promptSuggestions?: PromptSuggestions;
}

// ============================================================
// MULTI-ROUND TYPES
// ============================================================

export interface MultiRoundConfig {
  totalRounds: number;
  turnsPerRound: number;
}

export interface RoundResult {
  roundNumber: number;
  systemPrompt: string;
  messages: Message[];
  tacticCounts: TacticCounts;
  evaluation: EvaluationResult;
}

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

export type MultiRoundState = 
  | 'configuring'
  | 'running'           // Multi-round in progress
  | 'between_rounds'    // Generating next strategy
  | 'results';
