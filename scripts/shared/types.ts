/**
 * Tipos compartidos para la simulación de agentes
 */

export type AgentRole = 'red-agent' | 'auth-agent';

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

export interface SimulationResult {
  messages: Message[];
  totalTurns: number;
  manipulationTactics: {
    emotional: number;
    legal: number;
    technical: number;
  };
  authorizationOutcome: 'approved' | 'denied' | 'pending' | 'unclear';
  analysis: string;
}
