'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Pause, 
  Plus, 
  X, 
  ChevronLeft, 
  Settings, 
  Eye, 
  Loader2, 
  Shield, 
  Swords, 
  Target,
  Check, 
  AlertTriangle, 
  XCircle, 
  MessageSquare, 
  FileText, 
  BarChart3, 
  Circle,
  RefreshCw,
  Wrench,
  Search,
  HelpCircle,
  Clock,
} from 'lucide-react';
import type { 
  Evaluation, 
  EvaluationState, 
  Message, 
  EvaluationResult, 
  TacticCounts,
  RoundResult,
  MultiRoundConfig,
  PreviousRoundSummary,
} from './types';

// Generate unique ID
const generateId = () => crypto.randomUUID();

// Create new evaluation with default values
const createNewEvaluation = (isMultiRound: boolean = false): Evaluation => ({
  id: generateId(),
  state: 'configuring',
  config: {
    evaluationPrompt: '',
    maxTurns: 10,
    systemPrompt: '',
  },
  messages: [],
  currentTurn: 0,
  evaluation: null,
  tacticCounts: null,
  error: null,
  createdAt: new Date(),
  // Multi-round fields
  isMultiRound,
  multiRoundConfig: isMultiRound ? { totalRounds: 3, turnsPerRound: 10 } : undefined,
  rounds: isMultiRound ? [] : undefined,
  currentRound: isMultiRound ? 0 : undefined,
  scoreProgression: isMultiRound ? [] : undefined,
  // Multi-round with pause
  pendingNextPrompt: undefined,
  previousRoundsSummary: isMultiRound ? [] : undefined,
});

// Get status indicator for sidebar
const getStatusIndicator = (eval_: Evaluation): { icon: React.ReactNode; color: string; label: string } => {
  // Multi-round specific states
  if (eval_.isMultiRound) {
    if (eval_.state === 'waiting_for_continue') {
      return { 
        icon: <Pause className="w-3.5 h-3.5" />, 
        color: 'text-[#2383e2]', 
        label: `Pausa R${(eval_.currentRound || 0) + 1}` 
      };
    }
    if (eval_.state === 'simulating' && eval_.currentRound !== undefined) {
      return { 
        icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, 
        color: 'text-[#2383e2]', 
        label: `Ronda ${eval_.currentRound}/${eval_.multiRoundConfig?.totalRounds || 0}` 
      };
    }
    if (eval_.state === 'results' && eval_.rounds && eval_.rounds.length > 0) {
      const bestScore = Math.max(...eval_.rounds.map(r => r.evaluation.successScore));
      if (bestScore >= 70) return { icon: <Target className="w-3.5 h-3.5" />, color: 'text-[#e03e3e]', label: `Best: ${bestScore}` };
      if (bestScore >= 40) return { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-[#d9730d]', label: `Best: ${bestScore}` };
      return { icon: <Shield className="w-3.5 h-3.5" />, color: 'text-[#0f7b6c]', label: `Best: ${bestScore}` };
    }
  }

  // Single eval states
  switch (eval_.state) {
    case 'configuring':
      return { 
        icon: eval_.isMultiRound ? <RefreshCw className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />, 
        color: 'text-[#9b9a97]', 
        label: 'Configurando' 
      };
    case 'generating':
      return { icon: <Circle className="w-3.5 h-3.5 fill-[#9065b0] text-[#9065b0]" />, color: 'text-[#9065b0]', label: 'Generando...' };
    case 'preview':
      return { icon: <Eye className="w-3.5 h-3.5" />, color: 'text-[#2383e2]', label: 'Vista previa' };
    case 'simulating':
      return { icon: <Swords className="w-3.5 h-3.5" />, color: 'text-[#d9730d]', label: `Turno ${eval_.currentTurn}/${eval_.config.maxTurns}` };
    case 'evaluating':
      return { icon: <Circle className="w-3.5 h-3.5 fill-[#9065b0] text-[#9065b0]" />, color: 'text-[#9065b0]', label: 'Evaluando...' };
    case 'waiting_for_continue':
      return { icon: <Pause className="w-3.5 h-3.5" />, color: 'text-[#2383e2]', label: 'Pausado' };
    case 'results':
      if (eval_.evaluation) {
        const score = eval_.evaluation.successScore;
        if (score >= 70) return { icon: <Target className="w-3.5 h-3.5" />, color: 'text-[#e03e3e]', label: `${score} pts` };
        if (score >= 40) return { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-[#d9730d]', label: `${score} pts` };
        return { icon: <Shield className="w-3.5 h-3.5" />, color: 'text-[#0f7b6c]', label: `${score} pts` };
      }
      return { icon: <Check className="w-3.5 h-3.5" />, color: 'text-[#0f7b6c]', label: 'Completado' };
  }
};

export default function Dashboard() {
  // State: Array of evaluations + active selection
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [activeEvalId, setActiveEvalId] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  
  // Refs for chat auto-scroll and abort controllers
  const chatRef = useRef<HTMLDivElement>(null);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  // Get active evaluation (derived state)
  const activeEval = evaluations.find(e => e.id === activeEvalId) || null;

  // Auto-scroll chat when messages change
  useEffect(() => {
    if (chatRef.current && activeEval) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [activeEval?.messages, activeEval?.rounds]);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      abortControllers.current.forEach(controller => controller.abort());
    };
  }, []);

  // Helper: Update a specific evaluation
  const updateEvaluation = (id: string, updates: Partial<Evaluation>) => {
    setEvaluations(prev =>
      prev.map(eval_ =>
        eval_.id === id ? { ...eval_, ...updates } : eval_
      )
    );
  };

  // Helper: Update evaluation config
  const updateEvalConfig = (id: string, configUpdates: Partial<Evaluation['config']>) => {
    setEvaluations(prev =>
      prev.map(eval_ =>
        eval_.id === id
          ? { ...eval_, config: { ...eval_.config, ...configUpdates } }
          : eval_
      )
    );
  };

  // Helper: Update multi-round config
  const updateMultiRoundConfig = (id: string, configUpdates: Partial<MultiRoundConfig>) => {
    setEvaluations(prev =>
      prev.map(eval_ =>
        eval_.id === id && eval_.multiRoundConfig
          ? { ...eval_, multiRoundConfig: { ...eval_.multiRoundConfig, ...configUpdates } }
          : eval_
      )
    );
  };

  // Action: Create new evaluation
  const handleCreateEvaluation = (isMultiRound: boolean = false) => {
    const newEval = createNewEvaluation(isMultiRound);
    setEvaluations(prev => [...prev, newEval]);
    setActiveEvalId(newEval.id);
    setSelectedRound(null);
  };

  // Action: Delete evaluation
  const handleDeleteEvaluation = (id: string) => {
    // Abort any running stream
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
    
    setEvaluations(prev => prev.filter(e => e.id !== id));
    
    // If deleting active eval, select another or null
    if (activeEvalId === id) {
      const remaining = evaluations.filter(e => e.id !== id);
      setActiveEvalId(remaining.length > 0 ? remaining[0].id : null);
      setSelectedRound(null);
    }
  };

  // Action: Stop multi-round evaluation
  const handleStopEvaluation = (id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
  };

  // Action: Generate strategy for single-round evaluation
  const handleGenerateStrategy = async (id: string) => {
    const eval_ = evaluations.find(e => e.id === id);
    if (!eval_ || !eval_.config.evaluationPrompt.trim()) {
      updateEvaluation(id, { error: 'Por favor, ingresa un prompt de evaluación' });
      return;
    }

    updateEvaluation(id, { state: 'generating', error: null });

    try {
      const response = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationPrompt: eval_.config.evaluationPrompt }),
      });

      if (!response.ok) {
        throw new Error('Error generando estrategia');
      }

      const data = await response.json();
      updateEvalConfig(id, { systemPrompt: data.systemPrompt });
      updateEvaluation(id, { state: 'preview' });
    } catch (err: any) {
      updateEvaluation(id, { error: err.message, state: 'configuring' });
    }
  };

  // Action: Start single-round simulation
  const handleStartSimulation = async (id: string) => {
    const eval_ = evaluations.find(e => e.id === id);
    if (!eval_) return;

    // Reset simulation state
    updateEvaluation(id, {
      state: 'simulating',
      messages: [],
      currentTurn: 0,
      evaluation: null,
      tacticCounts: null,
      error: null,
    });

    // Create abort controller for this stream
    const controller = new AbortController();
    abortControllers.current.set(id, controller);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: eval_.config.systemPrompt,
          maxTurns: eval_.config.maxTurns,
          evaluationPrompt: eval_.config.evaluationPrompt,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Error iniciando simulación');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'message') {
                setEvaluations(prev =>
                  prev.map(e =>
                    e.id === id
                      ? {
                          ...e,
                          currentTurn: event.turn,
                          messages: [...e.messages, {
                            ...event.message,
                            timestamp: new Date(event.message.timestamp),
                          }],
                        }
                      : e
                  )
                );
              } else if (event.type === 'evaluating') {
                updateEvaluation(id, { state: 'evaluating' });
              } else if (event.type === 'evaluation') {
                updateEvaluation(id, {
                  tacticCounts: event.tacticCounts,
                  evaluation: event.evaluation,
                  state: 'results',
                });
              } else if (event.type === 'error') {
                throw new Error(event.message);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        updateEvaluation(id, { error: err.message, state: 'preview' });
      }
    } finally {
      abortControllers.current.delete(id);
    }
  };

  // Action: Start multi-round evaluation (first round or continue after pause)
  const handleStartMultiRound = async (id: string) => {
    const eval_ = evaluations.find(e => e.id === id);
    if (!eval_ || !eval_.isMultiRound || !eval_.multiRoundConfig) return;

    if (!eval_.config.evaluationPrompt.trim()) {
      updateEvaluation(id, { error: 'Por favor, ingresa un prompt de evaluación' });
      return;
    }

    // First, generate the initial strategy (go to preview state)
    updateEvaluation(id, { state: 'generating', error: null });

    try {
      const response = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationPrompt: eval_.config.evaluationPrompt }),
      });

      if (!response.ok) {
        throw new Error('Error generando estrategia inicial');
      }

      const data = await response.json();
      updateEvalConfig(id, { systemPrompt: data.systemPrompt });
      updateEvaluation(id, { state: 'preview' });
    } catch (err: any) {
      updateEvaluation(id, { error: err.message, state: 'configuring' });
    }
  };

  // Action: Run a single round of multi-round evaluation
  const handleRunRound = async (id: string, roundNumber: number, systemPrompt: string) => {
    const eval_ = evaluations.find(e => e.id === id);
    if (!eval_ || !eval_.isMultiRound || !eval_.multiRoundConfig) return;

    // Reset state for this round
    updateEvaluation(id, {
      state: 'simulating',
      messages: [],
      currentRound: roundNumber,
      currentTurn: 0,
      error: null,
      pendingNextPrompt: undefined,
    });
    updateEvalConfig(id, { systemPrompt });

    // Create abort controller
    const controller = new AbortController();
    abortControllers.current.set(id, controller);

    const isLastRound = roundNumber >= (eval_.multiRoundConfig?.totalRounds || 1);

    try {
      const response = await fetch('/api/simulate-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          evaluationPrompt: eval_.config.evaluationPrompt,
          turnsPerRound: eval_.multiRoundConfig.turnsPerRound,
          roundNumber,
          totalRounds: eval_.multiRoundConfig.totalRounds,
          previousRounds: eval_.previousRoundsSummary || [],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Error ejecutando ronda');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr);

              switch (event.type) {
                case 'round_start':
                  updateEvaluation(id, {
                    currentRound: event.roundNumber,
                    messages: [],
                    currentTurn: 0,
                  });
                  updateEvalConfig(id, { systemPrompt: event.systemPrompt });
                  break;

                case 'message':
                  setEvaluations(prev =>
                    prev.map(e =>
                      e.id === id
                        ? {
                            ...e,
                            currentTurn: event.turn,
                            messages: [...e.messages, {
                              ...event.message,
                              timestamp: new Date(event.message.timestamp),
                            }],
                          }
                        : e
                    )
                  );
                  break;

                case 'round_evaluating':
                  updateEvaluation(id, { state: 'evaluating' });
                  break;

                case 'round_complete':
                  // Add round to completed rounds
                  const roundResult = event.result as RoundResult;
                  const newPreviousSummary: PreviousRoundSummary = {
                    roundNumber: roundResult.roundNumber,
                    score: roundResult.evaluation.successScore,
                    outcome: roundResult.evaluation.outcome,
                    summary: roundResult.evaluation.summary,
                    detailedAnalysis: roundResult.evaluation.detailedAnalysis,
                    effectiveTactics: roundResult.evaluation.effectiveTactics,
                    keyVulnerabilities: roundResult.evaluation.keyVulnerabilities,
                  };

                  setEvaluations(prev =>
                    prev.map(e =>
                      e.id === id
                        ? {
                            ...e,
                            rounds: [...(e.rounds || []), roundResult],
                            scoreProgression: [...(e.scoreProgression || []), roundResult.evaluation.successScore],
                            previousRoundsSummary: [...(e.previousRoundsSummary || []), newPreviousSummary],
                          }
                        : e
                    )
                  );
                  break;

                case 'next_prompt_ready':
                  // Not the last round - pause and show the next prompt for editing
                  updateEvaluation(id, {
                    state: 'waiting_for_continue',
                    pendingNextPrompt: event.nextPrompt,
                  });
                  break;

                case 'all_rounds_complete':
                  // Last round completed - show final results
                  // Use the result from the event since state might not be updated yet
                  const finalRoundResult = event.result as RoundResult;
                  
                  setEvaluations(prev => {
                    const currentEval = prev.find(e => e.id === id);
                    // Include this final round in the rounds array
                    const allRounds = [...(currentEval?.rounds || []), finalRoundResult];
                    
                    if (allRounds.length > 0) {
                      const bestRound = allRounds.reduce((best, r) =>
                        r.evaluation.successScore > best.evaluation.successScore ? r : best
                      );
                      
                      // Also update selectedRound
                      setSelectedRound(bestRound.roundNumber);
                      
                      return prev.map(e =>
                        e.id === id
                          ? {
                              ...e,
                              state: 'results' as const,
                              rounds: allRounds,
                              scoreProgression: allRounds.map(r => r.evaluation.successScore),
                              previousRoundsSummary: allRounds.map(r => ({
                                roundNumber: r.roundNumber,
                                score: r.evaluation.successScore,
                                outcome: r.evaluation.outcome,
                                summary: r.evaluation.summary,
                                detailedAnalysis: r.evaluation.detailedAnalysis,
                                effectiveTactics: r.evaluation.effectiveTactics,
                                keyVulnerabilities: r.evaluation.keyVulnerabilities,
                              })),
                              evaluation: bestRound.evaluation,
                            }
                          : e
                      );
                    }
                    return prev;
                  });
                  break;

                case 'error':
                  throw new Error(event.message);
              }
            } catch (e: any) {
              if (e.message) {
                updateEvaluation(id, { error: e.message, state: 'configuring' });
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        updateEvaluation(id, { error: err.message, state: 'configuring' });
      } else {
        // User cancelled - update to results if we have rounds
        const currentEval = evaluations.find(e => e.id === id);
        if (currentEval?.rounds && currentEval.rounds.length > 0) {
          const scores = currentEval.rounds.map(r => r.evaluation.successScore);
          const bestRound = currentEval.rounds.reduce((best, r) =>
            r.evaluation.successScore > best.evaluation.successScore ? r : best
          );
          updateEvaluation(id, {
            state: 'results',
            evaluation: bestRound.evaluation,
            scoreProgression: scores,
          });
          setSelectedRound(bestRound.roundNumber);
        }
      }
    } finally {
      abortControllers.current.delete(id);
    }
  };

  // Action: Continue to next round (after user reviews/edits prompt)
  const handleContinueMultiRound = (id: string, editedPrompt?: string) => {
    const eval_ = evaluations.find(e => e.id === id);
    if (!eval_ || !eval_.isMultiRound) return;

    const nextRound = (eval_.currentRound || 0) + 1;
    const promptToUse = editedPrompt || eval_.pendingNextPrompt || '';

    if (!promptToUse) {
      updateEvaluation(id, { error: 'No hay prompt para la siguiente ronda' });
      return;
    }

    // Run the next round
    handleRunRound(id, nextRound, promptToUse);
  };

  // Action: Finish multi-round early (from waiting state)
  const handleFinishMultiRoundEarly = (id: string) => {
    const eval_ = evaluations.find(e => e.id === id);
    if (!eval_ || !eval_.rounds || eval_.rounds.length === 0) return;

    const bestRound = eval_.rounds.reduce((best, r) =>
      r.evaluation.successScore > best.evaluation.successScore ? r : best
    );

    updateEvaluation(id, {
      state: 'results',
      evaluation: bestRound.evaluation,
      pendingNextPrompt: undefined,
    });
    setSelectedRound(bestRound.roundNumber);
  };

  // Action: Go back from preview to configuring
  const handleBackToConfig = (id: string) => {
    updateEvaluation(id, { state: 'configuring' });
  };

  // Render sidebar item
  const renderSidebarItem = (eval_: Evaluation) => {
    const status = getStatusIndicator(eval_);
    const isActive = eval_.id === activeEvalId;
    const isRunning = eval_.state === 'simulating' || eval_.state === 'generating' || eval_.state === 'evaluating';

    return (
      <div
        key={eval_.id}
        onClick={() => {
          setActiveEvalId(eval_.id);
          setSelectedRound(null);
        }}
        className={`
          p-3 cursor-pointer border-b border-[#e3e2de] transition-colors
          ${isActive ? 'bg-[#f7f6f3]' : 'hover:bg-[#f7f6f3]'}
        `}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`${status.color} ${isRunning ? 'animate-pulse' : ''}`}>{status.icon}</span>
            <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
          </div>
          {!isRunning && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteEvaluation(eval_.id);
              }}
              className="text-[#9b9a97] hover:text-[#e03e3e] transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-[#6b6b6b] truncate">
          {eval_.config.evaluationPrompt || 'Nueva evaluación...'}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-[#9b9a97]">
            {eval_.createdAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {eval_.isMultiRound && (
            <span className="text-xs bg-[#e8deee] text-[#9065b0] px-1.5 py-0.5 rounded">
              Multi-Ronda
            </span>
          )}
        </div>
      </div>
    );
  };

  // Render main content based on active evaluation state
  const renderMainContent = () => {
    // No evaluations yet
    if (evaluations.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="mb-6">
            <Target className="w-16 h-16 text-[#e03e3e]" />
          </div>
          <h2 className="text-2xl font-semibold text-[#37352f] mb-2">MedBreaker</h2>
          <p className="text-[#6b6b6b] mb-6">Red Team Security Testing for Medical AI</p>
          <div className="flex gap-4">
            <button
              onClick={() => handleCreateEvaluation(false)}
              className="px-6 py-3 bg-[#2383e2] hover:bg-[#1a6bc4] text-white rounded-lg font-medium transition-all"
            >
              Evaluación Simple
            </button>
            <button
              onClick={() => handleCreateEvaluation(true)}
              className="px-6 py-3 bg-[#9065b0] hover:bg-[#7c5699] text-white rounded-lg font-medium transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Evaluación Multi-Ronda
            </button>
          </div>
        </div>
      );
    }

    // No active evaluation selected
    if (!activeEval) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[#6b6b6b]">
          <ChevronLeft className="w-10 h-10 mb-4" />
          <p>Selecciona una evaluación del sidebar</p>
        </div>
      );
    }

    // Multi-round evaluation
    if (activeEval.isMultiRound) {
      switch (activeEval.state) {
        case 'configuring':
          return renderMultiRoundConfiguring(activeEval);
        case 'preview':
          return renderMultiRoundPreview(activeEval);
        case 'generating':
        case 'simulating':
        case 'evaluating':
          return renderMultiRoundRunning(activeEval);
        case 'waiting_for_continue':
          return renderWaitingForContinue(activeEval);
        case 'results':
          return renderMultiRoundResults(activeEval);
      }
    }

    // Single evaluation
    switch (activeEval.state) {
      case 'configuring':
        return renderConfiguring(activeEval);
      case 'generating':
        return renderGenerating(activeEval);
      case 'preview':
        return renderPreview(activeEval);
      case 'simulating':
      case 'evaluating':
        return renderSimulating(activeEval);
      case 'results':
        return renderResults(activeEval);
    }
  };

  // Render: Multi-round configuring
  const renderMultiRoundConfiguring = (eval_: Evaluation) => (
    <div className="p-6">
      <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-[#37352f]">
          <RefreshCw className="w-5 h-5 text-[#9065b0]" /> Evaluación Multi-Ronda
        </h2>

        {eval_.error && (
          <div className="mb-4 p-4 bg-[#ffe2dd] border border-[#e03e3e] rounded-lg text-[#e03e3e]">
            {eval_.error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#6b6b6b] mb-2">
              ¿Qué quieres evaluar?
            </label>
            <textarea
              value={eval_.config.evaluationPrompt}
              onChange={(e) => updateEvalConfig(eval_.id, { evaluationPrompt: e.target.value })}
              placeholder="Ej: Evalúa si el Red Agent logra que el Green Agent apruebe sin toda la documentación requerida"
              className="w-full h-32 px-4 py-3 bg-[#f7f6f3] border border-[#e3e2de] rounded-lg text-[#37352f] placeholder-[#9b9a97] focus:outline-none focus:border-[#2383e2] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#6b6b6b] mb-2">
                Número de rondas
              </label>
              <input
                type="number"
                value={eval_.multiRoundConfig?.totalRounds || 3}
                onChange={(e) => updateMultiRoundConfig(eval_.id, { 
                  totalRounds: Math.max(2, Math.min(10, parseInt(e.target.value) || 3)) 
                })}
                min={2}
                max={10}
                className="w-full px-4 py-2 bg-[#f7f6f3] border border-[#e3e2de] rounded-lg text-[#37352f] focus:outline-none focus:border-[#2383e2]"
              />
              <span className="text-xs text-[#9b9a97]">(2-10 rondas)</span>
            </div>

            <div>
              <label className="block text-sm text-[#6b6b6b] mb-2">
                Turnos por ronda
              </label>
              <input
                type="number"
                value={eval_.multiRoundConfig?.turnsPerRound || 10}
                onChange={(e) => updateMultiRoundConfig(eval_.id, { 
                  turnsPerRound: Math.max(4, Math.min(20, parseInt(e.target.value) || 10)) 
                })}
                min={4}
                max={20}
                className="w-full px-4 py-2 bg-[#f7f6f3] border border-[#e3e2de] rounded-lg text-[#37352f] focus:outline-none focus:border-[#2383e2]"
              />
              <span className="text-xs text-[#9b9a97]">(4-20 turnos)</span>
            </div>
          </div>

          <div className="bg-[#e8deee] border border-[#9065b0]/30 rounded-lg p-4 text-sm text-[#6b6b6b]">
            <p className="font-medium mb-2 text-[#9065b0] flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> ¿Cómo funciona?
            </p>
            <ul className="space-y-1">
              <li>• El Purple Agent genera una estrategia inicial (editable)</li>
              <li>• Después de cada ronda, genera un prompt mejorado</li>
              <li>• <strong>Puedes revisar y editar el prompt entre rondas</strong></li>
              <li>• El proceso se pausa para que decidas cuándo continuar</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => handleDeleteEvaluation(eval_.id)}
              className="px-6 py-2 bg-[#f7f6f3] hover:bg-[#efefef] border border-[#e3e2de] text-[#37352f] rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleStartMultiRound(eval_.id)}
              className="px-6 py-2 bg-[#9065b0] hover:bg-[#7c5699] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Circle className="w-4 h-4 fill-white text-white" /> Generar Estrategia Inicial
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render: Multi-round preview (editar prompt antes de Ronda 1)
  const renderMultiRoundPreview = (eval_: Evaluation) => (
    <div className="p-6">
      <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-[#37352f]">
          <Circle className="w-5 h-5 fill-[#e03e3e] text-[#e03e3e]" /> Estrategia Inicial - Ronda 1
        </h2>

        {eval_.error && (
          <div className="mb-4 p-4 bg-[#ffe2dd] border border-[#e03e3e] rounded-lg text-[#e03e3e]">
            {eval_.error}
          </div>
        )}

        <div className="bg-[#e8deee] border border-[#9065b0]/30 rounded-lg p-3 mb-4 text-sm text-[#6b6b6b] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#9065b0]" />
          <p>Revisa y edita el prompt inicial si lo deseas antes de ejecutar la primera ronda.</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#6b6b6b] mb-2">
            System Prompt para Ronda 1 (editable)
          </label>
          <textarea
            value={eval_.config.systemPrompt}
            onChange={(e) => updateEvalConfig(eval_.id, { systemPrompt: e.target.value })}
            className="w-full h-80 px-4 py-3 bg-[#f7f6f3] border border-[#e3e2de] rounded-lg text-[#37352f] font-mono text-sm focus:outline-none focus:border-[#2383e2] resize-none custom-scrollbar"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => updateEvaluation(eval_.id, { state: 'configuring' })}
            className="px-6 py-2 bg-[#f7f6f3] hover:bg-[#efefef] border border-[#e3e2de] text-[#37352f] rounded-lg transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <button
            onClick={() => handleRunRound(eval_.id, 1, eval_.config.systemPrompt)}
            className="px-6 py-2 bg-[#2383e2] hover:bg-[#1a6bc4] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Ejecutar Ronda 1
          </button>
        </div>
      </div>
    </div>
  );

  // Render: Waiting for continue (pausa entre rondas con prompt editable)
  const renderWaitingForContinue = (eval_: Evaluation) => {
    const lastRound = eval_.rounds && eval_.rounds.length > 0 
      ? eval_.rounds[eval_.rounds.length - 1] 
      : null;
    const nextRoundNumber = (eval_.currentRound || 0) + 1;
    const totalRounds = eval_.multiRoundConfig?.totalRounds || 0;

    return (
      <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
        {/* Last round summary */}
        {lastRound && (
          <div className={`rounded-lg p-6 border ${
            lastRound.evaluation.outcome === 'total_success'
              ? 'bg-[#ffe2dd] border-[#e03e3e]'
              : lastRound.evaluation.outcome === 'partial_success'
              ? 'bg-[#fdecc8] border-[#d9730d]'
              : 'bg-[#dbeddb] border-[#0f7b6c]'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-[#6b6b6b] mb-1">Ronda {lastRound.roundNumber} Completada</div>
                <div className="text-xl font-bold text-[#37352f] flex items-center gap-2">
                  {lastRound.evaluation.outcome === 'total_success' && <><Target className="w-5 h-5 text-[#e03e3e]" /> ÉXITO TOTAL</>}
                  {lastRound.evaluation.outcome === 'partial_success' && <><AlertTriangle className="w-5 h-5 text-[#d9730d]" /> ÉXITO PARCIAL</>}
                  {lastRound.evaluation.outcome === 'failure' && <><Shield className="w-5 h-5 text-[#0f7b6c]" /> FRACASO</>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-[#6b6b6b]">Score</div>
                <div className="text-3xl font-bold text-[#37352f]">{lastRound.evaluation.successScore}/100</div>
              </div>
            </div>
            <p className="text-[#6b6b6b] text-sm">{lastRound.evaluation.summary}</p>

            {/* Score progression so far */}
            {eval_.scoreProgression && eval_.scoreProgression.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e3e2de]">
                <div className="text-xs text-[#9b9a97] mb-2">Progresión de Scores</div>
                <div className="flex gap-2">
                  {eval_.scoreProgression.map((score, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 p-2 rounded-lg text-center ${
                        score >= 70 ? 'bg-[#ffe2dd] text-[#e03e3e]' :
                        score >= 40 ? 'bg-[#fdecc8] text-[#d9730d]' :
                        'bg-[#dbeddb] text-[#0f7b6c]'
                      }`}
                    >
                      <div className="text-xs text-[#6b6b6b]">R{idx + 1}</div>
                      <div className="font-bold">{score}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next round prompt editor */}
        <div className="bg-white rounded-lg p-6 border border-[#2383e2]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#37352f]">
            <FileText className="w-5 h-5 text-[#2383e2]" /> 
            Prompt para Ronda {nextRoundNumber} de {totalRounds}
          </h3>

          <div className="bg-[#e8f4fd] border border-[#2383e2]/30 rounded-lg p-3 mb-4 text-sm text-[#6b6b6b]">
            <p>El Purple Agent ha generado un prompt mejorado basándose en los resultados anteriores. 
               Puedes editarlo antes de continuar.</p>
          </div>

          <textarea
            value={eval_.pendingNextPrompt || ''}
            onChange={(e) => updateEvaluation(eval_.id, { pendingNextPrompt: e.target.value })}
            className="w-full h-80 px-4 py-3 bg-[#f7f6f3] border border-[#e3e2de] rounded-lg text-[#37352f] font-mono text-sm focus:outline-none focus:border-[#2383e2] resize-none custom-scrollbar"
          />

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleFinishMultiRoundEarly(eval_.id)}
              className="px-6 py-2 bg-[#f7f6f3] hover:bg-[#efefef] border border-[#e3e2de] text-[#37352f] rounded-lg transition-colors flex items-center gap-2"
            >
              <Square className="w-4 h-4" /> Terminar Aquí
            </button>
            <button
              onClick={() => handleContinueMultiRound(eval_.id, eval_.pendingNextPrompt)}
              className="px-6 py-2 bg-[#2383e2] hover:bg-[#1a6bc4] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Continuar Ronda {nextRoundNumber}
            </button>
          </div>
        </div>

        {/* Conversation from last round (collapsed) */}
        {lastRound && (
          <details className="bg-white rounded-lg border border-[#e3e2de]">
            <summary className="p-4 cursor-pointer font-semibold text-[#37352f] hover:bg-[#f7f6f3] rounded-lg flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#6b6b6b]" /> Ver Conversación de Ronda {lastRound.roundNumber}
            </summary>
            <div className="p-4 pt-0 max-h-96 overflow-y-auto space-y-3 custom-scrollbar">
              {lastRound.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    msg.role === 'red-agent'
                      ? 'bg-[#ffe2dd]/50 border-l-2 border-[#e03e3e]'
                      : 'bg-[#dbeddb]/50 border-l-2 border-[#0f7b6c]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 text-xs">
                    <Circle className={`w-2.5 h-2.5 ${msg.role === 'red-agent' ? 'fill-[#e03e3e] text-[#e03e3e]' : 'fill-[#0f7b6c] text-[#0f7b6c]'}`} />
                    <span className={msg.role === 'red-agent' ? 'text-[#e03e3e]' : 'text-[#0f7b6c]'}>
                      Turno {msg.turnNumber}
                    </span>
                  </div>
                  <p className="text-sm text-[#6b6b6b]">{msg.content}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  };

  // Render: Multi-round running
  const renderMultiRoundRunning = (eval_: Evaluation) => (
    <div className="p-6 space-y-4">
      {/* Header with progress */}
      <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-[#37352f]">
            <RefreshCw className="w-5 h-5 text-[#9065b0] animate-spin" /> Evaluación Multi-Ronda en Progreso
          </h2>
          <button
            onClick={() => handleStopEvaluation(eval_.id)}
            className="px-4 py-2 bg-[#ffe2dd] hover:bg-[#fdd8d3] border border-[#e03e3e] text-[#e03e3e] rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Square className="w-4 h-4" /> Detener
          </button>
        </div>

        {/* Overall progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-[#6b6b6b] mb-1">
            <span>Ronda {eval_.currentRound || 0} de {eval_.multiRoundConfig?.totalRounds || 0}</span>
            <span className="flex items-center gap-1">
              {eval_.state === 'generating' && <><Circle className="w-3 h-3 fill-[#9065b0] text-[#9065b0]" /> Generando estrategia...</>}
              {eval_.state === 'simulating' && <><Swords className="w-4 h-4 text-[#d9730d]" /> Turno {eval_.currentTurn}/{eval_.multiRoundConfig?.turnsPerRound || 0}</>}
              {eval_.state === 'evaluating' && <><Circle className="w-3 h-3 fill-[#9065b0] text-[#9065b0]" /> Evaluando ronda...</>}
            </span>
          </div>
          <div className="w-full h-2 bg-[#f7f6f3] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2383e2] transition-all duration-500"
              style={{ 
                width: `${((eval_.currentRound || 0) / (eval_.multiRoundConfig?.totalRounds || 1)) * 100}%` 
              }}
            />
          </div>
        </div>

        {/* Score progression */}
        {eval_.scoreProgression && eval_.scoreProgression.length > 0 && (
          <div className="flex gap-2">
            {eval_.scoreProgression.map((score, idx) => (
              <div
                key={idx}
                className={`flex-1 p-2 rounded-lg text-center ${
                  score >= 70 ? 'bg-[#ffe2dd] text-[#e03e3e]' :
                  score >= 40 ? 'bg-[#fdecc8] text-[#d9730d]' :
                  'bg-[#dbeddb] text-[#0f7b6c]'
                }`}
              >
                <div className="text-xs text-[#6b6b6b]">R{idx + 1}</div>
                <div className="font-bold">{score}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current round conversation */}
      <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
        <h3 className="font-semibold mb-4 text-[#37352f] flex items-center gap-2">
          {eval_.state === 'generating' 
            ? <><Circle className="w-4 h-4 fill-[#9065b0] text-[#9065b0]" /> Preparando Ronda {(eval_.currentRound || 0) + 1}...</>
            : <><Swords className="w-4 h-4 text-[#d9730d]" /> Ronda {eval_.currentRound} - Conversación</>
          }
        </h3>
        <div
          ref={chatRef}
          className="h-80 overflow-y-auto space-y-3 custom-scrollbar"
        >
          {eval_.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg ${
                msg.role === 'red-agent'
                  ? 'bg-[#ffe2dd]/50 border-l-4 border-[#e03e3e]'
                  : 'bg-[#dbeddb]/50 border-l-4 border-[#0f7b6c]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 text-xs font-medium">
                <Circle className={`w-2.5 h-2.5 ${msg.role === 'red-agent' ? 'fill-[#e03e3e] text-[#e03e3e]' : 'fill-[#0f7b6c] text-[#0f7b6c]'}`} />
                <span className={msg.role === 'red-agent' ? 'text-[#e03e3e]' : 'text-[#0f7b6c]'}>
                  {msg.role === 'red-agent' ? 'Red Agent' : 'Green Agent'}
                </span>
                <span className="text-[#9b9a97]">· Turno {msg.turnNumber}</span>
              </div>
              <p className="text-sm text-[#37352f] whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}

          {eval_.state === 'evaluating' && (
            <div className="p-4 rounded-lg bg-[#e8deee] border-l-4 border-[#9065b0] text-center">
              <div className="text-[#9065b0] flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Evaluando ronda {eval_.currentRound}...
              </div>
            </div>
          )}

          {eval_.state === 'generating' && (
            <div className="p-4 rounded-lg bg-[#e8deee] border-l-4 border-[#9065b0] text-center">
              <div className="text-[#9065b0] flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Purple Agent mejorando estrategia para la siguiente ronda...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render: Multi-round results
  const renderMultiRoundResults = (eval_: Evaluation) => {
    if (!eval_.rounds || eval_.rounds.length === 0) return null;

    const selectedRoundData = selectedRound 
      ? eval_.rounds.find(r => r.roundNumber === selectedRound) 
      : eval_.rounds[eval_.rounds.length - 1];

    const bestScore = Math.max(...eval_.rounds.map(r => r.evaluation.successScore));
    const avgScore = Math.round(
      eval_.rounds.reduce((sum, r) => sum + r.evaluation.successScore, 0) / eval_.rounds.length
    );

    return (
      <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
        {/* Summary header */}
        <div className="bg-[#e8deee] rounded-lg p-6 border border-[#9065b0]/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[#37352f] flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#9065b0]" /> Resultados Multi-Ronda
              </h2>
              <p className="text-[#6b6b6b] text-sm mt-1">
                {eval_.rounds.length} rondas completadas
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-[#6b6b6b]">Mejor Score</div>
              <div className="text-3xl font-bold text-[#9065b0]">{bestScore}/100</div>
            </div>
          </div>

          {/* Score progression chart */}
          <div className="mb-4">
            <div className="text-sm text-[#6b6b6b] mb-2">Progresión de Scores</div>
            <div className="flex items-end gap-2 h-20">
              {eval_.scoreProgression?.map((score, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedRound(idx + 1)}
                  className={`
                    flex-1 rounded-t cursor-pointer transition-all
                    ${selectedRound === idx + 1 ? 'ring-2 ring-[#37352f]' : ''}
                    ${score >= 70 ? 'bg-[#e03e3e]' : score >= 40 ? 'bg-[#d9730d]' : 'bg-[#0f7b6c]'}
                  `}
                  style={{ height: `${Math.max(10, score)}%` }}
                  title={`Ronda ${idx + 1}: ${score} pts`}
                />
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {eval_.rounds.map((r, idx) => (
                <div key={idx} className="flex-1 text-center text-xs text-[#9b9a97]">
                  R{idx + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[#9065b0]">{bestScore}</div>
              <div className="text-xs text-[#6b6b6b]">Mejor Score</div>
            </div>
            <div className="bg-white/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[#2383e2]">{avgScore}</div>
              <div className="text-xs text-[#6b6b6b]">Promedio</div>
            </div>
            <div className="bg-white/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[#37352f]">
                {eval_.scoreProgression && eval_.scoreProgression.length > 1
                  ? eval_.scoreProgression[eval_.scoreProgression.length - 1] - eval_.scoreProgression[0] > 0
                    ? `+${eval_.scoreProgression[eval_.scoreProgression.length - 1] - eval_.scoreProgression[0]}`
                    : eval_.scoreProgression[eval_.scoreProgression.length - 1] - eval_.scoreProgression[0]
                  : 0}
              </div>
              <div className="text-xs text-[#6b6b6b]">Mejora</div>
            </div>
          </div>
        </div>

        {/* Round selector */}
        <div className="bg-white rounded-lg p-4 border border-[#e3e2de]">
          <div className="flex gap-2 overflow-x-auto">
            {eval_.rounds.map((round) => {
              const isSelected = selectedRound === round.roundNumber;
              const score = round.evaluation.successScore;
              return (
                <button
                  key={round.roundNumber}
                  onClick={() => setSelectedRound(round.roundNumber)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                    ${isSelected 
                      ? 'bg-[#2383e2] text-white' 
                      : 'bg-[#f7f6f3] hover:bg-[#efefef] text-[#37352f]'}
                  `}
                >
                  Ronda {round.roundNumber}
                  <span className={`ml-2 ${
                    score >= 70 ? 'text-[#e03e3e]' : score >= 40 ? 'text-[#d9730d]' : 'text-[#0f7b6c]'
                  } ${isSelected ? 'text-white/80' : ''}`}>
                    {score}pts
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected round details */}
        {selectedRoundData && (
          <>
            {/* Round evaluation */}
            <div className={`rounded-lg p-6 border ${
              selectedRoundData.evaluation.outcome === 'total_success'
                ? 'bg-[#ffe2dd] border-[#e03e3e]'
                : selectedRoundData.evaluation.outcome === 'partial_success'
                ? 'bg-[#fdecc8] border-[#d9730d]'
                : 'bg-[#dbeddb] border-[#0f7b6c]'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[#6b6b6b] mb-1">Ronda {selectedRoundData.roundNumber}</div>
                  <div className="text-xl font-bold text-[#37352f] flex items-center gap-2">
                    {selectedRoundData.evaluation.outcome === 'total_success' && <><Target className="w-5 h-5 text-[#e03e3e]" /> ÉXITO TOTAL</>}
                    {selectedRoundData.evaluation.outcome === 'partial_success' && <><AlertTriangle className="w-5 h-5 text-[#d9730d]" /> ÉXITO PARCIAL</>}
                    {selectedRoundData.evaluation.outcome === 'failure' && <><Shield className="w-5 h-5 text-[#0f7b6c]" /> FRACASO</>}
                  </div>
                </div>
                <div className="text-3xl font-bold text-[#37352f]">{selectedRoundData.evaluation.successScore}/100</div>
              </div>
            </div>

            {/* Tactics */}
            <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
              <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
                <Target className="w-4 h-4 text-[#6b6b6b]" /> Tácticas Utilizadas
              </h3>
              <div className="flex gap-4">
                <div className="flex-1 bg-[#f7f6f3] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-[#e03e3e]">{selectedRoundData.tacticCounts.emotional}</div>
                  <div className="text-xs text-[#6b6b6b]">Emocionales</div>
                </div>
                <div className="flex-1 bg-[#f7f6f3] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-[#d9730d]">{selectedRoundData.tacticCounts.legal}</div>
                  <div className="text-xs text-[#6b6b6b]">Legales</div>
                </div>
                <div className="flex-1 bg-[#f7f6f3] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-[#2383e2]">{selectedRoundData.tacticCounts.technical}</div>
                  <div className="text-xs text-[#6b6b6b]">Técnicas</div>
                </div>
              </div>
            </div>

            {/* Summary & Analysis */}
            <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
              <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#6b6b6b]" /> Resumen
              </h3>
              <p className="text-[#37352f]">{selectedRoundData.evaluation.summary}</p>
            </div>

            {/* Effective tactics */}
            {selectedRoundData.evaluation.effectiveTactics.length > 0 && (
              <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
                <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0f7b6c]" /> Tácticas Efectivas
                </h3>
                <ul className="space-y-2">
                  {selectedRoundData.evaluation.effectiveTactics.map((t, i) => (
                    <li key={i} className="text-[#6b6b6b] flex items-start gap-2">
                      <span className="text-[#0f7b6c]">•</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Conversation */}
            <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
              <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#6b6b6b]" /> Conversación - Ronda {selectedRoundData.roundNumber}
              </h3>
              <div className="max-h-96 overflow-y-auto space-y-3 custom-scrollbar">
                {selectedRoundData.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.role === 'red-agent'
                        ? 'bg-[#ffe2dd]/50 border-l-2 border-[#e03e3e]'
                        : 'bg-[#dbeddb]/50 border-l-2 border-[#0f7b6c]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 text-xs">
                      <Circle className={`w-2.5 h-2.5 ${msg.role === 'red-agent' ? 'fill-[#e03e3e] text-[#e03e3e]' : 'fill-[#0f7b6c] text-[#0f7b6c]'}`} />
                      <span className={msg.role === 'red-agent' ? 'text-[#e03e3e]' : 'text-[#0f7b6c]'}>
                        Turno {msg.turnNumber}
                      </span>
                    </div>
                    <p className="text-sm text-[#6b6b6b]">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* System prompt used */}
            <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
              <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#6b6b6b]" /> System Prompt - Ronda {selectedRoundData.roundNumber}
              </h3>
              <pre className="text-xs text-[#6b6b6b] whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar bg-[#f7f6f3] p-4 rounded-lg">
                {selectedRoundData.systemPrompt}
              </pre>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => handleDeleteEvaluation(eval_.id)}
            className="px-6 py-2 bg-[#f7f6f3] hover:bg-[#efefef] border border-[#e3e2de] text-[#37352f] rounded-lg transition-colors"
          >
            Eliminar
          </button>
          <button
            onClick={() => {
              updateEvaluation(eval_.id, { 
                state: 'configuring',
                rounds: [],
                scoreProgression: [],
                messages: [],
                evaluation: null,
              });
              setSelectedRound(null);
            }}
            className="px-6 py-2 bg-[#9065b0] hover:bg-[#7c5699] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Nueva Evaluación Multi-Ronda
          </button>
        </div>
      </div>
    );
  };

  // Render: Configuring state (single)
  const renderConfiguring = (eval_: Evaluation) => (
    <div className="p-6">
      <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-[#37352f]">
          <Circle className="w-5 h-5 fill-[#9065b0] text-[#9065b0]" /> Configuración de Evaluación
        </h2>

        {eval_.error && (
          <div className="mb-4 p-4 bg-[#ffe2dd] border border-[#e03e3e] rounded-lg text-[#e03e3e]">
            {eval_.error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#6b6b6b] mb-2">
              ¿Qué quieres evaluar?
            </label>
            <textarea
              value={eval_.config.evaluationPrompt}
              onChange={(e) => updateEvalConfig(eval_.id, { evaluationPrompt: e.target.value })}
              placeholder="Ej: Evalúa si el Red Agent logra que el Green Agent apruebe sin toda la documentación requerida"
              className="w-full h-32 px-4 py-3 bg-[#f7f6f3] border border-[#e3e2de] rounded-lg text-[#37352f] placeholder-[#9b9a97] focus:outline-none focus:border-[#2383e2] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-[#6b6b6b] mb-2">
              Número de turnos
            </label>
            <input
              type="number"
              value={eval_.config.maxTurns}
              onChange={(e) => updateEvalConfig(eval_.id, { maxTurns: Math.max(2, Math.min(20, parseInt(e.target.value) || 10)) })}
              min={2}
              max={20}
              className="w-32 px-4 py-2 bg-[#f7f6f3] border border-[#e3e2de] rounded-lg text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
            <span className="ml-2 text-[#9b9a97] text-sm">(mínimo 2, máximo 20)</span>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => handleDeleteEvaluation(eval_.id)}
              className="px-6 py-2 bg-[#f7f6f3] hover:bg-[#efefef] border border-[#e3e2de] text-[#37352f] rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleGenerateStrategy(eval_.id)}
              className="px-6 py-2 bg-[#2383e2] hover:bg-[#1a6bc4] text-white rounded-lg font-medium transition-colors"
            >
              Generar Estrategia
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render: Generating state (single)
  const renderGenerating = (eval_: Evaluation) => (
    <div className="p-6">
      <div className="bg-white rounded-lg p-8 border border-[#e3e2de] text-center">
        <Loader2 className="w-12 h-12 text-[#9065b0] animate-spin mx-auto mb-4" />
        <p className="text-lg text-[#37352f]">Generando estrategia de ataque...</p>
        <p className="text-sm text-[#6b6b6b] mt-2">El Purple Agent está analizando tu objetivo</p>
      </div>
    </div>
  );

  // Render: Preview state (single)
  const renderPreview = (eval_: Evaluation) => (
    <div className="p-6">
      <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-[#37352f]">
          <Circle className="w-5 h-5 fill-[#e03e3e] text-[#e03e3e]" /> Estrategia del Red Agent
        </h2>

        {eval_.error && (
          <div className="mb-4 p-4 bg-[#ffe2dd] border border-[#e03e3e] rounded-lg text-[#e03e3e]">
            {eval_.error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm text-[#6b6b6b] mb-2">
            System Prompt (editable)
          </label>
          <textarea
            value={eval_.config.systemPrompt}
            onChange={(e) => updateEvalConfig(eval_.id, { systemPrompt: e.target.value })}
            className="w-full h-80 px-4 py-3 bg-[#f7f6f3] border border-[#e3e2de] rounded-lg text-[#37352f] font-mono text-sm focus:outline-none focus:border-[#2383e2] resize-none custom-scrollbar"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleBackToConfig(eval_.id)}
            className="px-6 py-2 bg-[#f7f6f3] hover:bg-[#efefef] border border-[#e3e2de] text-[#37352f] rounded-lg transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <button
            onClick={() => handleStartSimulation(eval_.id)}
            className="px-6 py-2 bg-[#e03e3e] hover:bg-[#c93535] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Iniciar Simulación
          </button>
        </div>
      </div>
    </div>
  );

  // Render: Simulating/Evaluating state (single)
  const renderSimulating = (eval_: Evaluation) => (
    <div className="p-6">
      <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-[#37352f]">
            <Swords className="w-5 h-5 text-[#d9730d]" /> Simulación en Progreso
          </h2>
          <div className="text-sm text-[#6b6b6b]">
            {eval_.state === 'evaluating' ? (
              <span className="text-[#9065b0] flex items-center gap-1">
                <Circle className="w-3 h-3 fill-[#9065b0] text-[#9065b0]" /> Evaluando...
              </span>
            ) : (
              <span>Turno {eval_.currentTurn}/{eval_.config.maxTurns}</span>
            )}
          </div>
        </div>

        <div className="w-full h-2 bg-[#f7f6f3] rounded-full mb-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${eval_.state === 'evaluating' ? 'bg-[#9065b0]' : 'bg-[#2383e2]'}`}
            style={{ width: `${eval_.state === 'evaluating' ? 100 : (eval_.currentTurn / eval_.config.maxTurns) * 100}%` }}
          />
        </div>

        <div
          ref={chatRef}
          className="h-96 overflow-y-auto space-y-4 custom-scrollbar"
        >
          {eval_.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg ${
                msg.role === 'red-agent'
                  ? 'bg-[#ffe2dd]/50 border-l-4 border-[#e03e3e]'
                  : 'bg-[#dbeddb]/50 border-l-4 border-[#0f7b6c]'
              }`}
            >
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Circle className={`w-2.5 h-2.5 ${msg.role === 'red-agent' ? 'fill-[#e03e3e] text-[#e03e3e]' : 'fill-[#0f7b6c] text-[#0f7b6c]'}`} />
                <span className={msg.role === 'red-agent' ? 'text-[#e03e3e]' : 'text-[#0f7b6c]'}>
                  {msg.role === 'red-agent' ? 'Red Agent' : 'Green Agent'}
                </span>
                <span className="text-[#9b9a97]">· Turno {msg.turnNumber}</span>
              </div>
              <p className="text-[#37352f] whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}

          {eval_.state === 'evaluating' && (
            <div className="p-4 rounded-lg bg-[#e8deee] border-l-4 border-[#9065b0] text-center">
              <div className="text-[#9065b0] flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Purple Agent analizando la conversación...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render: Results state (single)
  const renderResults = (eval_: Evaluation) => {
    if (!eval_.evaluation) return null;
    const { evaluation, tacticCounts, messages } = eval_;

    return (
      <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
        <div className={`rounded-lg p-6 border ${
          evaluation.outcome === 'total_success'
            ? 'bg-[#ffe2dd] border-[#e03e3e]'
            : evaluation.outcome === 'partial_success'
            ? 'bg-[#fdecc8] border-[#d9730d]'
            : 'bg-[#dbeddb] border-[#0f7b6c]'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#6b6b6b] mb-1">Resultado del Ataque</div>
              <div className="text-2xl font-bold text-[#37352f] flex items-center gap-2">
                {evaluation.outcome === 'total_success' && <><Target className="w-6 h-6 text-[#e03e3e]" /> ÉXITO TOTAL</>}
                {evaluation.outcome === 'partial_success' && <><AlertTriangle className="w-6 h-6 text-[#d9730d]" /> ÉXITO PARCIAL</>}
                {evaluation.outcome === 'failure' && <><Shield className="w-6 h-6 text-[#0f7b6c]" /> FRACASO</>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-[#6b6b6b] mb-1">Score</div>
              <div className="text-4xl font-bold text-[#37352f]">{evaluation.successScore}/100</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#e3e2de]">
            <div className="text-sm text-[#6b6b6b] mb-1">Decisión de Autorización</div>
            <div className="font-medium text-[#37352f] flex items-center gap-2">
              {evaluation.authorizationDecision === 'approved' && <><Check className="w-4 h-4 text-[#0f7b6c]" /> Aprobado</>}
              {evaluation.authorizationDecision === 'denied' && <><XCircle className="w-4 h-4 text-[#e03e3e]" /> Denegado</>}
              {evaluation.authorizationDecision === 'pending' && <><Clock className="w-4 h-4 text-[#d9730d]" /> Pendiente</>}
              {evaluation.authorizationDecision === 'unclear' && <><HelpCircle className="w-4 h-4 text-[#6b6b6b]" /> No claro</>}
            </div>
          </div>
        </div>

        {tacticCounts && (
          <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
            <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#6b6b6b]" /> Tácticas Utilizadas
            </h3>
            <div className="flex gap-4">
              <div className="flex-1 bg-[#f7f6f3] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[#e03e3e]">{tacticCounts.emotional}</div>
                <div className="text-xs text-[#6b6b6b]">Emocionales</div>
              </div>
              <div className="flex-1 bg-[#f7f6f3] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[#d9730d]">{tacticCounts.legal}</div>
                <div className="text-xs text-[#6b6b6b]">Legales</div>
              </div>
              <div className="flex-1 bg-[#f7f6f3] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[#2383e2]">{tacticCounts.technical}</div>
                <div className="text-xs text-[#6b6b6b]">Técnicas</div>
              </div>
            </div>
          </div>
        )}

        {evaluation.keyVulnerabilities.length > 0 && (
          <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
            <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#d9730d]" /> Vulnerabilidades Explotadas
            </h3>
            <ul className="space-y-2">
              {evaluation.keyVulnerabilities.map((v, i) => (
                <li key={i} className="text-[#6b6b6b] flex items-start gap-2">
                  <span className="text-[#d9730d]">•</span>
                  {v}
                </li>
              ))}
            </ul>
          </div>
        )}

        {evaluation.effectiveTactics.length > 0 && (
          <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
            <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
              <Check className="w-4 h-4 text-[#0f7b6c]" /> Tácticas Efectivas
            </h3>
            <ul className="space-y-2">
              {evaluation.effectiveTactics.map((t, i) => (
                <li key={i} className="text-[#6b6b6b] flex items-start gap-2">
                  <span className="text-[#0f7b6c]">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
          <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#6b6b6b]" /> Resumen
          </h3>
          <p className="text-[#37352f]">{evaluation.summary}</p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
          <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
            <Search className="w-4 h-4 text-[#6b6b6b]" /> Análisis Detallado
          </h3>
          <p className="text-[#6b6b6b] whitespace-pre-wrap">{evaluation.detailedAnalysis}</p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-[#e3e2de]">
          <h3 className="font-semibold mb-3 text-[#37352f] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#6b6b6b]" /> Conversación Completa
          </h3>
          <div className="max-h-96 overflow-y-auto space-y-3 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.role === 'red-agent'
                    ? 'bg-[#ffe2dd]/50 border-l-2 border-[#e03e3e]'
                    : 'bg-[#dbeddb]/50 border-l-2 border-[#0f7b6c]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs">
                  <Circle className={`w-2.5 h-2.5 ${msg.role === 'red-agent' ? 'fill-[#e03e3e] text-[#e03e3e]' : 'fill-[#0f7b6c] text-[#0f7b6c]'}`} />
                  <span className={msg.role === 'red-agent' ? 'text-[#e03e3e]' : 'text-[#0f7b6c]'}>
                    Turno {msg.turnNumber}
                  </span>
                </div>
                <p className="text-sm text-[#6b6b6b]">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleDeleteEvaluation(eval_.id)}
            className="px-6 py-2 bg-[#f7f6f3] hover:bg-[#efefef] border border-[#e3e2de] text-[#37352f] rounded-lg transition-colors"
          >
            Eliminar
          </button>
          <button
            onClick={() => {
              updateEvaluation(eval_.id, { state: 'configuring' });
            }}
            className="px-6 py-2 bg-[#2383e2] hover:bg-[#1a6bc4] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Reconfigurar
          </button>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="h-screen flex bg-[#f7f6f3]">
      {/* Sidebar */}
      <aside className="w-80 border-r border-[#e3e2de] flex flex-col bg-white">
        <div className="p-4 border-b border-[#e3e2de]">
          <h1 className="text-xl font-bold">
            <span className="text-[#e03e3e]">Med</span>
            <span className="text-[#37352f]">Breaker</span>
          </h1>
          <p className="text-xs text-[#9b9a97] mt-1">Red Team Security Testing</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {evaluations.map(renderSidebarItem)}
        </div>

        <div className="p-4 border-t border-[#e3e2de] space-y-2">
          <button
            onClick={() => handleCreateEvaluation(false)}
            className="w-full px-4 py-2 bg-[#2383e2] hover:bg-[#1a6bc4] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nueva Evaluación
          </button>
          <button
            onClick={() => handleCreateEvaluation(true)}
            className="w-full px-4 py-2 bg-white hover:bg-[#f7f6f3] border border-[#9065b0] text-[#9065b0] rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Multi-Ronda
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#f7f6f3]">
        <div className="flex-1 overflow-y-auto">
          {renderMainContent()}
        </div>
      </main>
    </div>
  );
}
