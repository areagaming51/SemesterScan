import React from 'react';
import { Zap, Brain } from 'lucide-react';

/**
 * AnalysisModeSelector - Toggle between PRO and FAST scanning modes
 * PRO: Deep content analysis (slower, quota-limited)
 * FAST: Metadata-based heuristics (instant, unlimited)
 */
export default function AnalysisModeSelector({ mode, onChange, disabled }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-medium text-gray-400">Analysis Mode</span>
        <div className="flex-1 h-px bg-gradient-to-r from-purple-500/20 to-transparent"></div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* FAST Mode Button */}
        <button
          onClick={() => onChange('FAST')}
          disabled={disabled}
          className={`
            relative px-4 py-3 rounded-lg font-medium transition-all duration-300
            ${mode === 'FAST' 
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/30' 
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border border-gray-700'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" />
            <span>FAST</span>
          </div>
          {mode === 'FAST' && (
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-lg animate-pulse"></div>
          )}
          <p className="text-xs mt-1 opacity-80">Metadata-based</p>
        </button>

        {/* PRO Mode Button */}
        <button
          onClick={() => onChange('PRO')}
          disabled={disabled}
          className={`
            relative px-4 py-3 rounded-lg font-medium transition-all duration-300
            ${mode === 'PRO' 
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30' 
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border border-gray-700'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-center justify-center gap-2">
            <Brain className="w-4 h-4" />
            <span>PRO</span>
          </div>
          {mode === 'PRO' && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-lg animate-pulse"></div>
          )}
          <p className="text-xs mt-1 opacity-80">AI Content Analysis</p>
        </button>
      </div>

      {/* Mode Description */}
      <div className="mt-3 p-3 bg-gray-900/50 rounded-lg border border-gray-800">
        {mode === 'FAST' ? (
          <div className="text-xs text-gray-400">
            <p className="font-medium text-yellow-400 mb-1">⚡ Lightning Fast</p>
            <p>Uses filename patterns and metadata. Instant results, unlimited scans.</p>
          </div>
        ) : (
          <div className="text-xs text-gray-400">
            <p className="font-medium text-purple-400 mb-1">🧠 Deep Analysis</p>
            <p>Reads file content with AI. More accurate but uses daily quota.</p>
          </div>
        )}
      </div>
    </div>
  );
}
