import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Trophy, HelpCircle, ArrowRight, RotateCcw } from 'lucide-react';

export default function QuizModal({ isOpen, onClose, quizData }) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    if (!isOpen || !quizData) return null;

    const currentQuestion = quizData.questions[currentQuestionIndex];

    const handleOptionSelect = (optionIndex) => {
        if (selectedOption !== null) return; // Prevent changing answer
        setSelectedOption(optionIndex);

        const isCorrect = optionIndex === currentQuestion.correctAnswerIndex;
        if (isCorrect) setScore(s => s + 1);

        setShowResult(true);
    };

    const handleNext = () => {
        if (currentQuestionIndex < quizData.questions.length - 1) {
            setCurrentQuestionIndex(i => i + 1);
            setSelectedOption(null);
            setShowResult(false);
        } else {
            setIsFinished(true);
        }
    };

    const resetQuiz = () => {
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setScore(0);
        setShowResult(false);
        setIsFinished(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/20">

                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                            <HelpCircle className="w-5 h-5 text-indigo-600" /> Instant Quiz
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Generated from your notes</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    {!isFinished ? (
                        <div className="space-y-6">
                            {/* Progress Bar */}
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                                    style={{ width: `${((currentQuestionIndex) / quizData.questions.length) * 100}%` }}
                                />
                            </div>

                            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <span>Question {currentQuestionIndex + 1}/{quizData.questions.length}</span>
                                <span>Score: {score}</span>
                            </div>

                            <h4 className="text-lg font-bold text-slate-800 leading-relaxed">
                                {currentQuestion.question}
                            </h4>

                            <div className="space-y-3">
                                {currentQuestion.options.map((option, idx) => {
                                    const isSelected = selectedOption === idx;
                                    const isCorrect = idx === currentQuestion.correctAnswerIndex;
                                    const showCorrectness = showResult && (isSelected || isCorrect);

                                    let btnClass = "w-full text-left p-4 rounded-xl border-2 transition-all font-medium flex items-center justify-between ";

                                    if (showResult) {
                                        if (isCorrect) btnClass += "bg-emerald-50 border-emerald-500 text-emerald-700";
                                        else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-700";
                                        else btnClass += "bg-slate-50 border-transparent text-slate-400 opacity-50";
                                    } else {
                                        if (isSelected) btnClass += "bg-indigo-50 border-indigo-500 text-indigo-700";
                                        else btnClass += "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-600";
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleOptionSelect(idx)}
                                            disabled={showResult}
                                            className={btnClass}
                                        >
                                            <span>{option}</span>
                                            {showResult && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                                            {showResult && isSelected && !isCorrect && <AlertCircle className="w-5 h-5 text-red-600" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {showResult && (
                                <div className="flex justify-end pt-4 animate-in slide-in-from-bottom-2">
                                    <button
                                        onClick={handleNext}
                                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200"
                                    >
                                        {currentQuestionIndex < quizData.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 space-y-6">
                            <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <Trophy className="w-12 h-12 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">Quiz Complete!</h3>
                                <p className="text-slate-500">You scored</p>
                            </div>
                            <div className="text-5xl font-black text-indigo-600">
                                {score}/{quizData.questions.length}
                            </div>
                            <p className="text-sm text-slate-400 max-w-xs mx-auto">
                                Knowledge check complete. Review the generated study brief for more details.
                            </p>

                            <div className="flex gap-3 justify-center pt-6">
                                <button onClick={resetQuiz} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2">
                                    <RotateCcw className="w-4 h-4" /> Retry
                                </button>
                                <button onClick={onClose} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
