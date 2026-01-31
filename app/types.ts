// Re-export types for client-side usage
export type AgentRole = 'red-agent' | 'green-agent';

export interface Message {
  role: AgentRole;
  content: string;
  timestamp: Date;
  turnNumber: number;
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

// Dashboard specific types
export type DashboardState = 
  | 'idle'           // Initial state - show "Create Eval" button
  | 'configuring'    // User entering evaluation prompt + turns
  | 'generating'     // Generating Red Agent strategy
  | 'preview'        // Showing strategy, user can edit
  | 'simulating'     // Running simulation
  | 'evaluating'     // Purple Agent evaluating
  | 'results';       // Showing final results

export interface SimulationConfig {
  evaluationPrompt: string;
  maxTurns: number;
  systemPrompt: string;
}
