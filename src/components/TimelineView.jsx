import React from 'react';
import { useMemo } from 'react';
import { Calendar, Clock, BookOpen, AlertCircle } from 'lucide-react';

export default function TimelineView({ events }) {
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [events]);

    if (!events || events.length === 0) {
        return (
            <div className="text-center py-10 text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No timeline events found in this chat.</p>
            </div>
        );
    }

    return (
        <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 py-4">
            {sortedEvents.map((event, index) => {
                const date = new Date(event.date);
                const isPast = date < new Date();

                return (
                    <div key={index} className="relative pl-8 group">
                        {/* Dot */}
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm transition-colors ${event.type === 'exam' ? 'bg-red-500' :
                                event.type === 'assignment' ? 'bg-amber-500' :
                                    'bg-blue-500'
                            }`} />

                        {/* Content Card */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-bold uppercase tracking-wider ${isPast ? 'text-gray-400' : 'text-slate-600'
                                    }`}>
                                    {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${event.type === 'exam' ? 'bg-red-50 text-red-600' :
                                        event.type === 'assignment' ? 'bg-amber-50 text-amber-600' :
                                            'bg-blue-50 text-blue-600'
                                    }`}>
                                    {event.type.toUpperCase()}
                                </span>
                            </div>

                            <h4 className="font-bold text-slate-800 mb-1">{event.title}</h4>
                            <p className="text-sm text-slate-500 leading-relaxed">{event.description}</p>

                            {event.context && (
                                <div className="mt-3 pt-3 border-t border-slate-50 text-xs text-slate-400 italic">
                                    "{event.context}"
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
