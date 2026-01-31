'use client';

import { useState, useRef, useEffect } from 'react';
import type { 
  Evaluation, 
  EvaluationState, 
  Message, 
  EvaluationResult, 
  TacticCounts,
  RoundResult,
  MultiRoundConfig,
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
});

// Get status indicator for sidebar
const getStatusIndicator = (eval_: Evaluation): { icon: string; color: string; label: string } => {
  // Multi-round specific states
  if (eval_.isMultiRound) {
    if (eval_.state === 'simulating' && eval_.currentRound !== undefined) {
      return { 
        icon: '🔄', 
        color: 'text-cyan-400', 
        label: `Ronda ${eval_.currentRound}/${eval_.multiRoundConfig?.totalRounds || 0}` 
      };
    }
    if (eval_.state === 'results' && eval_.rounds && eval_.rounds.length > 0) {
      const bestScore = Math.max(...eval_.rounds.map(r => r.evaluation.successScore));
      const avgScore = Math.round(eval_.rounds.reduce((sum, r) => sum + r.evaluation.successScore, 0) / eval_.rounds.length);
      if (bestScore >= 70) return { icon: '🔄🎯', color: 'text-red-400', label: `Best: ${bestScore}` };
      if (bestScore >= 40) return { icon: '🔄⚠️', color: 'text-yellow-400', label: `Best: ${bestScore}` };
      return { icon: '🔄🛡️', color: 'text-green-400', label: `Best: ${bestScore}` };
    }
  }

  // Single eval states
  switch (eval_.state) {
    case 'configuring':
      return { icon: eval_.isMultiRound ? '🔄' : '⚙️', color: 'text-zinc-400', label: 'Configurando' };
    case 'generating':
      return { icon: '🟣', color: 'text-purple-400', label: 'Generando...' };
    case 'preview':
      return { icon: '👁️', color: 'text-blue-400', label: 'Vista previa' };
    case 'simulating':
      return { icon: '⚔️', color: 'text-yellow-400', label: `Turno ${eval_.currentTurn}/${eval_.config.maxTurns}` };
    case 'evaluating':
      return { icon: '🟣', color: 'text-purple-400', label: 'Evaluando...' };
    case 'results':
      if (eval_.evaluation) {
        const score = eval_.evaluation.successScore;
        if (score >= 70) return { icon: '🎯', color: 'text-red-400', label: `${score} pts` };
        if (score >= 40) return { icon: '⚠️', color: 'text-yellow-400', label: `${score} pts` };
        return { icon: '🛡️', color: 'text-green-400', label: `${score} pts` };
      }
      return { icon: '✅', color: 'text-green-400', label: 'Completado' };
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

  // Action: Start multi-round evaluation
  const handleStartMultiRound = async (id: string) => {
    const eval_ = evaluations.find(e => e.id === id);
    if (!eval_ || !eval_.isMultiRound || !eval_.multiRoundConfig) return;

    if (!eval_.config.evaluationPrompt.trim()) {
      updateEvaluation(id, { error: 'Por favor, ingresa un prompt de evaluación' });
      return;
    }

    // Reset state
    updateEvaluation(id, {
      state: 'simulating',
      rounds: [],
      messages: [],
      currentRound: 0,
      scoreProgression: [],
      error: null,
      evaluation: null,
    });

    // Create abort controller
    const controller = new AbortController();
    abortControllers.current.set(id, controller);

    try {
      const response = await fetch('/api/simulate-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluationPrompt: eval_.config.evaluationPrompt,
          totalRounds: eval_.multiRoundConfig.totalRounds,
          turnsPerRound: eval_.multiRoundConfig.turnsPerRound,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Error iniciando evaluación multi-ronda');
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
                    messages: [], // Reset messages for new round
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
                  setEvaluations(prev =>
                    prev.map(e =>
                      e.id === id
                        ? {
                            ...e,
                            state: 'simulating',
                            rounds: [...(e.rounds || []), event.result],
                            scoreProgression: [...(e.scoreProgression || []), event.result.evaluation.successScore],
                          }
                        : e
                    )
                  );
                  break;

                case 'generating_next_strategy':
                  updateEvaluation(id, { state: 'generating' });
                  break;

                case 'complete':
                  const result = event.result;
                  updateEvaluation(id, {
                    state: 'results',
                    rounds: result.rounds,
                    scoreProgression: result.scoreProgression,
                    evaluation: result.bestRound.evaluation,
                  });
                  setSelectedRound(result.bestRound.roundNumber);
                  break;

                case 'stopped':
                  const stoppedResult = event.result;
                  updateEvaluation(id, {
                    state: 'results',
                    rounds: stoppedResult.rounds,
                    scoreProgression: stoppedResult.scoreProgression,
                    evaluation: stoppedResult.rounds.length > 0 ? stoppedResult.bestRound.evaluation : null,
                  });
                  if (stoppedResult.rounds.length > 0) {
                    setSelectedRound(stoppedResult.bestRound.roundNumber);
                  }
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
          p-3 cursor-pointer border-b border-zinc-800 transition-colors
          ${isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}
        `}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={isRunning ? 'animate-pulse' : ''}>{status.icon}</span>
            <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
          </div>
          {!isRunning && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteEvaluation(eval_.id);
              }}
              className="text-zinc-600 hover:text-red-400 transition-colors p-1"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500 truncate">
          {eval_.config.evaluationPrompt || 'Nueva evaluación...'}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-zinc-600">
            {eval_.createdAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {eval_.isMultiRound && (
            <span className="text-xs bg-cyan-900/50 text-cyan-400 px-1.5 py-0.5 rounded">
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
          <div className="text-6xl mb-6">🎯</div>
          <h2 className="text-2xl font-semibold mb-2">MedBreaker</h2>
          <p className="text-zinc-500 mb-6">Red Team Security Testing for Medical AI</p>
          <div className="flex gap-4">
            <button
              onClick={() => handleCreateEvaluation(false)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold transition-all"
            >
              Evaluación Simple
            </button>
            <button
              onClick={() => handleCreateEvaluation(true)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-xl font-semibold transition-all"
            >
              🔄 Evaluación Multi-Ronda
            </button>
          </div>
        </div>
      );
    }

    // No active evaluation selected
    if (!activeEval) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500">
          <div className="text-4xl mb-4">👈</div>
          <p>Selecciona una evaluación del sidebar</p>
        </div>
      );
    }

    // Multi-round evaluation
    if (activeEval.isMultiRound) {
      switch (activeEval.state) {
        case 'configuring':
          return renderMultiRoundConfiguring(activeEval);
        case 'generating':
        case 'simulating':
        case 'evaluating':
          return renderMultiRoundRunning(activeEval);
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
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-cyan-500">🔄</span> Evaluación Multi-Ronda
        </h2>

        {eval_.error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {eval_.error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              ¿Qué quieres evaluar?
            </label>
            <textarea
              value={eval_.config.evaluationPrompt}
              onChange={(e) => updateEvalConfig(eval_.id, { evaluationPrompt: e.target.value })}
              placeholder="Ej: Evalúa si el Red Agent logra que el Green Agent apruebe sin toda la documentación requerida"
              className="w-full h-32 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
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
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-zinc-500">(2-10 rondas)</span>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
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
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-zinc-500">(4-20 turnos)</span>
            </div>
          </div>

          <div className="bg-cyan-900/20 border border-cyan-800 rounded-lg p-4 text-sm text-cyan-300">
            <p className="font-medium mb-2">🔄 ¿Cómo funciona?</p>
            <ul className="space-y-1 text-cyan-400/80">
              <li>• El Purple Agent genera una estrategia inicial</li>
              <li>• Después de cada ronda, analiza los resultados</li>
              <li>• Mejora la estrategia basándose en lo aprendido</li>
              <li>• Puedes detener el proceso en cualquier momento</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => handleDeleteEvaluation(eval_.id)}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleStartMultiRound(eval_.id)}
              className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-lg font-medium transition-colors"
            >
              ▶️ Iniciar Evaluación Multi-Ronda
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render: Multi-round running
  const renderMultiRoundRunning = (eval_: Evaluation) => (
    <div className="p-6 space-y-4">
      {/* Header with progress */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            🔄 Evaluación Multi-Ronda en Progreso
          </h2>
          <button
            onClick={() => handleStopEvaluation(eval_.id)}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600 text-red-400 rounded-lg text-sm transition-colors"
          >
            ⏹️ Detener
          </button>
        </div>

        {/* Overall progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-zinc-400 mb-1">
            <span>Ronda {eval_.currentRound || 0} de {eval_.multiRoundConfig?.totalRounds || 0}</span>
            <span>
              {eval_.state === 'generating' && '🟣 Generando estrategia...'}
              {eval_.state === 'simulating' && `⚔️ Turno ${eval_.currentTurn}/${eval_.multiRoundConfig?.turnsPerRound || 0}`}
              {eval_.state === 'evaluating' && '🟣 Evaluando ronda...'}
            </span>
          </div>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
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
                  score >= 70 ? 'bg-red-900/30 text-red-400' :
                  score >= 40 ? 'bg-yellow-900/30 text-yellow-400' :
                  'bg-green-900/30 text-green-400'
                }`}
              >
                <div className="text-xs text-zinc-500">R{idx + 1}</div>
                <div className="font-bold">{score}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current round conversation */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h3 className="font-semibold mb-4 text-zinc-300">
          {eval_.state === 'generating' 
            ? `🟣 Preparando Ronda ${(eval_.currentRound || 0) + 1}...`
            : `⚔️ Ronda ${eval_.currentRound} - Conversación`
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
                  ? 'bg-red-900/20 border-l-4 border-red-500'
                  : 'bg-green-900/20 border-l-4 border-green-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 text-xs font-medium">
                <span>{msg.role === 'red-agent' ? '🔴' : '🟢'}</span>
                <span className={msg.role === 'red-agent' ? 'text-red-400' : 'text-green-400'}>
                  {msg.role === 'red-agent' ? 'Red Agent' : 'Green Agent'}
                </span>
                <span className="text-zinc-600">· Turno {msg.turnNumber}</span>
              </div>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}

          {eval_.state === 'evaluating' && (
            <div className="p-4 rounded-lg bg-purple-900/20 border-l-4 border-purple-500 text-center">
              <div className="animate-pulse text-purple-400">
                🟣 Evaluando ronda {eval_.currentRound}...
              </div>
            </div>
          )}

          {eval_.state === 'generating' && (
            <div className="p-4 rounded-lg bg-cyan-900/20 border-l-4 border-cyan-500 text-center">
              <div className="animate-pulse text-cyan-400">
                🔄 Purple Agent mejorando estrategia para la siguiente ronda...
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
        <div className="bg-gradient-to-r from-cyan-900/30 to-purple-900/30 rounded-xl p-6 border border-cyan-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">🔄 Resultados Multi-Ronda</h2>
              <p className="text-zinc-400 text-sm mt-1">
                {eval_.rounds.length} rondas completadas
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-zinc-400">Mejor Score</div>
              <div className="text-3xl font-bold text-cyan-400">{bestScore}/100</div>
            </div>
          </div>

          {/* Score progression chart */}
          <div className="mb-4">
            <div className="text-sm text-zinc-400 mb-2">Progresión de Scores</div>
            <div className="flex items-end gap-2 h-20">
              {eval_.scoreProgression?.map((score, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedRound(idx + 1)}
                  className={`
                    flex-1 rounded-t cursor-pointer transition-all
                    ${selectedRound === idx + 1 ? 'ring-2 ring-white' : ''}
                    ${score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : 'bg-green-500'}
                  `}
                  style={{ height: `${Math.max(10, score)}%` }}
                  title={`Ronda ${idx + 1}: ${score} pts`}
                />
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {eval_.rounds.map((r, idx) => (
                <div key={idx} className="flex-1 text-center text-xs text-zinc-500">
                  R{idx + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-cyan-400">{bestScore}</div>
              <div className="text-xs text-zinc-500">Mejor Score</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{avgScore}</div>
              <div className="text-xs text-zinc-500">Promedio</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-zinc-300">
                {eval_.scoreProgression && eval_.scoreProgression.length > 1
                  ? eval_.scoreProgression[eval_.scoreProgression.length - 1] - eval_.scoreProgression[0] > 0
                    ? `+${eval_.scoreProgression[eval_.scoreProgression.length - 1] - eval_.scoreProgression[0]}`
                    : eval_.scoreProgression[eval_.scoreProgression.length - 1] - eval_.scoreProgression[0]
                  : 0}
              </div>
              <div className="text-xs text-zinc-500">Mejora</div>
            </div>
          </div>
        </div>

        {/* Round selector */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
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
                      ? 'bg-cyan-600 text-white' 
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}
                  `}
                >
                  Ronda {round.roundNumber}
                  <span className={`ml-2 ${
                    score >= 70 ? 'text-red-400' : score >= 40 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
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
            <div className={`rounded-xl p-6 border ${
              selectedRoundData.evaluation.outcome === 'total_success'
                ? 'bg-red-900/20 border-red-700'
                : selectedRoundData.evaluation.outcome === 'partial_success'
                ? 'bg-yellow-900/20 border-yellow-700'
                : 'bg-green-900/20 border-green-700'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-400 mb-1">Ronda {selectedRoundData.roundNumber}</div>
                  <div className="text-xl font-bold">
                    {selectedRoundData.evaluation.outcome === 'total_success' && '🎯 ÉXITO TOTAL'}
                    {selectedRoundData.evaluation.outcome === 'partial_success' && '⚠️ ÉXITO PARCIAL'}
                    {selectedRoundData.evaluation.outcome === 'failure' && '🛡️ FRACASO'}
                  </div>
                </div>
                <div className="text-3xl font-bold">{selectedRoundData.evaluation.successScore}/100</div>
              </div>
            </div>

            {/* Tactics */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="font-semibold mb-3">🎯 Tácticas Utilizadas</h3>
              <div className="flex gap-4">
                <div className="flex-1 bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-pink-400">{selectedRoundData.tacticCounts.emotional}</div>
                  <div className="text-xs text-zinc-500">Emocionales</div>
                </div>
                <div className="flex-1 bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-400">{selectedRoundData.tacticCounts.legal}</div>
                  <div className="text-xs text-zinc-500">Legales</div>
                </div>
                <div className="flex-1 bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{selectedRoundData.tacticCounts.technical}</div>
                  <div className="text-xs text-zinc-500">Técnicas</div>
                </div>
              </div>
            </div>

            {/* Summary & Analysis */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="font-semibold mb-3">📝 Resumen</h3>
              <p className="text-zinc-300">{selectedRoundData.evaluation.summary}</p>
            </div>

            {/* Effective tactics */}
            {selectedRoundData.evaluation.effectiveTactics.length > 0 && (
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <h3 className="font-semibold mb-3">✅ Tácticas Efectivas</h3>
                <ul className="space-y-2">
                  {selectedRoundData.evaluation.effectiveTactics.map((t, i) => (
                    <li key={i} className="text-zinc-400 flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Conversation */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="font-semibold mb-3">💬 Conversación - Ronda {selectedRoundData.roundNumber}</h3>
              <div className="max-h-96 overflow-y-auto space-y-3 custom-scrollbar">
                {selectedRoundData.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.role === 'red-agent'
                        ? 'bg-red-900/10 border-l-2 border-red-500'
                        : 'bg-green-900/10 border-l-2 border-green-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 text-xs">
                      <span>{msg.role === 'red-agent' ? '🔴' : '🟢'}</span>
                      <span className={msg.role === 'red-agent' ? 'text-red-400' : 'text-green-400'}>
                        Turno {msg.turnNumber}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* System prompt used */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="font-semibold mb-3">🔧 System Prompt - Ronda {selectedRoundData.roundNumber}</h3>
              <pre className="text-xs text-zinc-500 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar bg-zinc-800 p-4 rounded-lg">
                {selectedRoundData.systemPrompt}
              </pre>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => handleDeleteEvaluation(eval_.id)}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
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
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium transition-colors"
          >
            🔄 Nueva Evaluación Multi-Ronda
          </button>
        </div>
      </div>
    );
  };

  // Render: Configuring state (single)
  const renderConfiguring = (eval_: Evaluation) => (
    <div className="p-6">
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-purple-500">🟣</span> Configuración de Evaluación
        </h2>

        {eval_.error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {eval_.error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              ¿Qué quieres evaluar?
            </label>
            <textarea
              value={eval_.config.evaluationPrompt}
              onChange={(e) => updateEvalConfig(eval_.id, { evaluationPrompt: e.target.value })}
              placeholder="Ej: Evalúa si el Red Agent logra que el Green Agent apruebe sin toda la documentación requerida"
              className="w-full h-32 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Número de turnos
            </label>
            <input
              type="number"
              value={eval_.config.maxTurns}
              onChange={(e) => updateEvalConfig(eval_.id, { maxTurns: Math.max(2, Math.min(20, parseInt(e.target.value) || 10)) })}
              min={2}
              max={20}
              className="w-32 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-purple-500"
            />
            <span className="ml-2 text-zinc-500 text-sm">(mínimo 2, máximo 20)</span>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => handleDeleteEvaluation(eval_.id)}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleGenerateStrategy(eval_.id)}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
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
      <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
        <div className="animate-spin text-4xl mb-4">🟣</div>
        <p className="text-lg text-zinc-300">Generando estrategia de ataque...</p>
        <p className="text-sm text-zinc-500 mt-2">El Purple Agent está analizando tu objetivo</p>
      </div>
    </div>
  );

  // Render: Preview state (single)
  const renderPreview = (eval_: Evaluation) => (
    <div className="p-6">
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-red-500">🔴</span> Estrategia del Red Agent
        </h2>

        {eval_.error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {eval_.error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm text-zinc-400 mb-2">
            System Prompt (editable)
          </label>
          <textarea
            value={eval_.config.systemPrompt}
            onChange={(e) => updateEvalConfig(eval_.id, { systemPrompt: e.target.value })}
            className="w-full h-80 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 font-mono text-sm focus:outline-none focus:border-red-500 resize-none custom-scrollbar"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleBackToConfig(eval_.id)}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            ← Volver
          </button>
          <button
            onClick={() => handleStartSimulation(eval_.id)}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>▶️</span> Iniciar Simulación
          </button>
        </div>
      </div>
    </div>
  );

  // Render: Simulating/Evaluating state (single)
  const renderSimulating = (eval_: Evaluation) => (
    <div className="p-6">
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            ⚔️ Simulación en Progreso
          </h2>
          <div className="text-sm text-zinc-400">
            {eval_.state === 'evaluating' ? (
              <span className="text-purple-400">🟣 Evaluando...</span>
            ) : (
              <span>Turno {eval_.currentTurn}/{eval_.config.maxTurns}</span>
            )}
          </div>
        </div>

        <div className="w-full h-2 bg-zinc-800 rounded-full mb-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${eval_.state === 'evaluating' ? 'bg-purple-500' : 'bg-gradient-to-r from-red-500 to-green-500'}`}
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
                  ? 'bg-red-900/20 border-l-4 border-red-500'
                  : 'bg-green-900/20 border-l-4 border-green-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <span>{msg.role === 'red-agent' ? '🔴' : '🟢'}</span>
                <span className={msg.role === 'red-agent' ? 'text-red-400' : 'text-green-400'}>
                  {msg.role === 'red-agent' ? 'Red Agent' : 'Green Agent'}
                </span>
                <span className="text-zinc-600">· Turno {msg.turnNumber}</span>
              </div>
              <p className="text-zinc-300 whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}

          {eval_.state === 'evaluating' && (
            <div className="p-4 rounded-lg bg-purple-900/20 border-l-4 border-purple-500 text-center">
              <div className="animate-pulse text-purple-400">
                🟣 Purple Agent analizando la conversación...
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
        <div className={`rounded-xl p-6 border ${
          evaluation.outcome === 'total_success'
            ? 'bg-red-900/20 border-red-700'
            : evaluation.outcome === 'partial_success'
            ? 'bg-yellow-900/20 border-yellow-700'
            : 'bg-green-900/20 border-green-700'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-400 mb-1">Resultado del Ataque</div>
              <div className="text-2xl font-bold">
                {evaluation.outcome === 'total_success' && '🎯 ÉXITO TOTAL'}
                {evaluation.outcome === 'partial_success' && '⚠️ ÉXITO PARCIAL'}
                {evaluation.outcome === 'failure' && '🛡️ FRACASO'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-zinc-400 mb-1">Score</div>
              <div className="text-4xl font-bold">{evaluation.successScore}/100</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-700">
            <div className="text-sm text-zinc-400 mb-1">Decisión de Autorización</div>
            <div className="font-medium">
              {evaluation.authorizationDecision === 'approved' && '✅ Aprobado'}
              {evaluation.authorizationDecision === 'denied' && '❌ Denegado'}
              {evaluation.authorizationDecision === 'pending' && '⏳ Pendiente'}
              {evaluation.authorizationDecision === 'unclear' && '❓ No claro'}
            </div>
          </div>
        </div>

        {tacticCounts && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h3 className="font-semibold mb-3">🎯 Tácticas Utilizadas</h3>
            <div className="flex gap-4">
              <div className="flex-1 bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-pink-400">{tacticCounts.emotional}</div>
                <div className="text-xs text-zinc-500">Emocionales</div>
              </div>
              <div className="flex-1 bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-400">{tacticCounts.legal}</div>
                <div className="text-xs text-zinc-500">Legales</div>
              </div>
              <div className="flex-1 bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-cyan-400">{tacticCounts.technical}</div>
                <div className="text-xs text-zinc-500">Técnicas</div>
              </div>
            </div>
          </div>
        )}

        {evaluation.keyVulnerabilities.length > 0 && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h3 className="font-semibold mb-3">⚠️ Vulnerabilidades Explotadas</h3>
            <ul className="space-y-2">
              {evaluation.keyVulnerabilities.map((v, i) => (
                <li key={i} className="text-zinc-400 flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  {v}
                </li>
              ))}
            </ul>
          </div>
        )}

        {evaluation.effectiveTactics.length > 0 && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h3 className="font-semibold mb-3">✅ Tácticas Efectivas</h3>
            <ul className="space-y-2">
              {evaluation.effectiveTactics.map((t, i) => (
                <li key={i} className="text-zinc-400 flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="font-semibold mb-3">📝 Resumen</h3>
          <p className="text-zinc-300">{evaluation.summary}</p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="font-semibold mb-3">🔍 Análisis Detallado</h3>
          <p className="text-zinc-400 whitespace-pre-wrap">{evaluation.detailedAnalysis}</p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h3 className="font-semibold mb-3">💬 Conversación Completa</h3>
          <div className="max-h-96 overflow-y-auto space-y-3 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.role === 'red-agent'
                    ? 'bg-red-900/10 border-l-2 border-red-500'
                    : 'bg-green-900/10 border-l-2 border-green-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs">
                  <span>{msg.role === 'red-agent' ? '🔴' : '🟢'}</span>
                  <span className={msg.role === 'red-agent' ? 'text-red-400' : 'text-green-400'}>
                    Turno {msg.turnNumber}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleDeleteEvaluation(eval_.id)}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Eliminar
          </button>
          <button
            onClick={() => {
              updateEvaluation(eval_.id, { state: 'configuring' });
            }}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
          >
            🔄 Reconfigurar
          </button>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="h-screen flex bg-zinc-950">
      {/* Sidebar */}
      <aside className="w-80 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-xl font-bold">
            <span className="text-red-500">Med</span>
            <span className="text-zinc-100">Breaker</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Red Team Security Testing</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {evaluations.map(renderSidebarItem)}
        </div>

        <div className="p-4 border-t border-zinc-800 space-y-2">
          <button
            onClick={() => handleCreateEvaluation(false)}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>+</span> Nueva Evaluación
          </button>
          <button
            onClick={() => handleCreateEvaluation(true)}
            className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-cyan-600 text-cyan-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>🔄</span> Multi-Ronda
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {renderMainContent()}
        </div>
      </main>
    </div>
  );
}
