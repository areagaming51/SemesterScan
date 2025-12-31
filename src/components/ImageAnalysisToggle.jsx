import React from 'react';
import { Image, ImageOff } from 'lucide-react';

/**
 * ImageAnalysisToggle - Enable/disable image content analysis
 * When enabled, images are sent to Gemini Vision API for classification
 */
export default function ImageAnalysisToggle({ enabled, onChange, disabled }) {
    return (
        <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium text-gray-400">Image Processing</span>
                <div className="flex-1 h-px bg-gradient-to-r from-blue-500/20 to-transparent"></div>
            </div>

            <button
                onClick={() => onChange(!enabled)}
                disabled={disabled}
                className={`
          w-full px-4 py-3 rounded-lg font-medium transition-all duration-300
          flex items-center justify-between
          ${enabled
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border border-gray-700'
                    }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
            >
                <div className="flex items-center gap-3">
                    {enabled ? (
                        <Image className="w-5 h-5" />
                    ) : (
                        <ImageOff className="w-5 h-5" />
                    )}
                    <div className="text-left">
                        <div className="text-sm font-semibold">
                            {enabled ? 'Analyze Images' : 'Skip Images'}
                        </div>
                        <div className="text-xs opacity-80">
                            {enabled
                                ? 'AI will classify image content'
                                : 'Images will be ignored (faster)'
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

            {/* Warning for PRO mode */}
            {enabled && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <span className="text-lg">ℹ️</span>
                    <p className="text-xs text-blue-300">
                        Image analysis uses additional quota in PRO mode
                    </p>
                </div>
            )}
        </div>
    );
}
