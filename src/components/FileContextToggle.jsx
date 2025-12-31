import React from 'react';
import { FileText, Lock } from 'lucide-react';

/**
 * FileContextToggle - Enable/disable sending file context (first 100 chars) to AI
 * When enabled, the first 100 characters of file content are sent for better categorization
 */
export default function FileContextToggle({ enabled, onChange, disabled }) {
    return (
        <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium text-gray-400">File Content Analysis</span>
                <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent"></div>
            </div>

            <button
                onClick={() => onChange(!enabled)}
                disabled={disabled}
                className={`
          w-full px-4 py-3 rounded-lg font-medium transition-all duration-300
          flex items-center justify-between
          ${enabled
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border border-gray-700'
                    }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
            >
                <div className="flex items-center gap-3">
                    {enabled ? (
                        <FileText className="w-5 h-5" />
                    ) : (
                        <Lock className="w-5 h-5" />
                    )}
                    <div className="text-left">
                        <div className="text-sm font-semibold">
                            {enabled ? 'Use File Context' : 'Metadata Only'}
                        </div>
                        <div className="text-xs opacity-80">
                            {enabled
                                ? 'Send first 100 chars for accuracy'
                                : 'Only filename sent (max privacy)'
                            }
                        </div>
                    </div>
                </div>

                {/* Toggle Switch Visual */}
                <div className={`
          relative w-14 h-7 rounded-full transition-colors duration-300
          ${enabled ? 'bg-white/20' : 'bg-gray-700'}
        `}>
                    <div className={`
            absolute top-1 left-1 w-5 h-5 rounded-full bg-white
            transition-transform duration-300 shadow-lg
            ${enabled ? 'translate-x-7' : 'translate-x-0'}
          `}></div>
                </div>
            </button>

            {/* Info message */}
            {enabled && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                    <span className="text-lg">⚡</span>
                    <p className="text-xs text-amber-300">
                        Improves accuracy for ambiguous filenames. Only first 100 characters sent.
                    </p>
                </div>
            )}
            {!enabled && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <span className="text-lg">🔒</span>
                    <p className="text-xs text-green-300">
                        Maximum privacy: No file content sent to AI
                    </p>
                </div>
            )}
        </div>
    );
}
