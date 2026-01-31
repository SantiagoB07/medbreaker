'use client';

import { useState, useRef, useEffect } from 'react';
import type { DashboardState, Message, EvaluationResult, TacticCounts } from './types';

export default function Dashboard() {
  // State
  const [state, setState] = useState<DashboardState>('idle');
  const [evaluationPrompt, setEvaluationPrompt] = useState('');
  const [maxTurns, setMaxTurns] = useState(10);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [tacticCounts, setTacticCounts] = useState<TacticCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Generate strategy
  const handleGenerateStrategy = async () => {
    if (!evaluationPrompt.trim()) {
      setError('Por favor, ingresa un prompt de evaluación');
      return;
    }

    setError(null);
    setState('generating');

    try {
      const response = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationPrompt }),
      });

      if (!response.ok) {
        throw new Error('Error generando estrategia');
      }

      const data = await response.json();
      setSystemPrompt(data.systemPrompt);
      setState('preview');
    } catch (err: any) {
      setError(err.message);
      setState('configuring');
    }
  };

  // Start simulation
  const handleStartSimulation = async () => {
    setError(null);
    setMessages([]);
    setCurrentTurn(0);
    setEvaluation(null);
    setTacticCounts(null);
    setState('simulating');

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          systemPrompt, 
          maxTurns,
          evaluationPrompt 
        }),
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
                setCurrentTurn(event.turn);
                setMessages(prev => [...prev, {
                  ...event.message,
                  timestamp: new Date(event.message.timestamp)
                }]);
              } else if (event.type === 'evaluating') {
                setState('evaluating');
              } else if (event.type === 'evaluation') {
                setTacticCounts(event.tacticCounts);
                setEvaluation(event.evaluation);
                setState('results');
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
      setError(err.message);
      setState('preview');
    }
  };

  // Reset to start
  const handleReset = () => {
    setState('idle');
    setEvaluationPrompt('');
    setMaxTurns(10);
    setSystemPrompt('');
    setMessages([]);
    setCurrentTurn(0);
    setEvaluation(null);
    setTacticCounts(null);
    setError(null);
  };

  // Render based on state
  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-red-500">Med</span>
            <span className="text-zinc-100">Breaker</span>
          </h1>
          <p className="text-zinc-400">Red Team Security Testing for Medical AI</p>
        </header>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* State: Idle */}
        {state === 'idle' && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="text-6xl mb-6">🎯</div>
            <button
              onClick={() => setState('configuring')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-xl text-xl font-semibold transition-all transform hover:scale-105"
            >
              Crear Evaluación
            </button>
            <p className="mt-4 text-zinc-500 text-sm">
              Configura y ejecuta un ataque de Red Team contra el sistema
            </p>
          </div>
        )}

        {/* State: Configuring */}
        {state === 'configuring' && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-purple-500">🟣</span> Configuración de Evaluación
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  ¿Qué quieres evaluar?
                </label>
                <textarea
                  value={evaluationPrompt}
                  onChange={(e) => setEvaluationPrompt(e.target.value)}
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
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(Math.max(2, Math.min(20, parseInt(e.target.value) || 10)))}
                  min={2}
                  max={20}
                  className="w-32 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-purple-500"
                />
                <span className="ml-2 text-zinc-500 text-sm">
                  (mínimo 2, máximo 20)
                </span>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setState('idle')}
                  className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerateStrategy}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
                >
                  Generar Estrategia
                </button>
              </div>
            </div>
          </div>
        )}

        {/* State: Generating */}
        {state === 'generating' && (
          <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
            <div className="animate-spin text-4xl mb-4">🟣</div>
            <p className="text-lg text-zinc-300">Generando estrategia de ataque...</p>
            <p className="text-sm text-zinc-500 mt-2">El Purple Agent está analizando tu objetivo</p>
          </div>
        )}

        {/* State: Preview */}
        {state === 'preview' && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-red-500">🔴</span> Estrategia del Red Agent
            </h2>
            
            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">
                System Prompt (editable)
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-80 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 font-mono text-sm focus:outline-none focus:border-red-500 resize-none custom-scrollbar"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setState('configuring')}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                ← Volver
              </button>
              <button
                onClick={handleStartSimulation}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <span>▶️</span> Iniciar Simulación
              </button>
            </div>
          </div>
        )}

        {/* State: Simulating / Evaluating */}
        {(state === 'simulating' || state === 'evaluating') && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                ⚔️ Simulación en Progreso
              </h2>
              <div className="text-sm text-zinc-400">
                {state === 'evaluating' ? (
                  <span className="text-purple-400">🟣 Evaluando...</span>
                ) : (
                  <span>Turno {currentTurn}/{maxTurns}</span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-zinc-800 rounded-full mb-4 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${state === 'evaluating' ? 'bg-purple-500' : 'bg-gradient-to-r from-red-500 to-green-500'}`}
                style={{ width: `${state === 'evaluating' ? 100 : (currentTurn / maxTurns) * 100}%` }}
              />
            </div>

            {/* Chat messages */}
            <div 
              ref={chatRef}
              className="h-96 overflow-y-auto space-y-4 custom-scrollbar"
            >
              {messages.map((msg, idx) => (
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
              
              {state === 'evaluating' && (
                <div className="p-4 rounded-lg bg-purple-900/20 border-l-4 border-purple-500 text-center">
                  <div className="animate-pulse text-purple-400">
                    🟣 Purple Agent analizando la conversación...
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* State: Results */}
        {state === 'results' && evaluation && (
          <div className="space-y-6">
            {/* Evaluation Header */}
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

            {/* Tactics Used */}
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

            {/* Vulnerabilities */}
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

            {/* Effective Tactics */}
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

            {/* Summary */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="font-semibold mb-3">📝 Resumen</h3>
              <p className="text-zinc-300">{evaluation.summary}</p>
            </div>

            {/* Detailed Analysis */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="font-semibold mb-3">🔍 Análisis Detallado</h3>
              <p className="text-zinc-400 whitespace-pre-wrap">{evaluation.detailedAnalysis}</p>
            </div>

            {/* Conversation Review */}
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

            {/* Reset Button */}
            <div className="text-center">
              <button
                onClick={handleReset}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-colors"
              >
                🔄 Nueva Evaluación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
