
import { createEvents } from 'ics';

/**
 * Generates an ICS file from exam dates found in the chat log.
 * @param {string} chatContent - The full chat text.
 */
export function generateExamCalendar(chatContent) {
    const lines = chatContent.split('\n');
    const events = [];

    // Regex for basic date detection (very simple heuristic)
    // Matches: "Exam on 12th Dec", "Test 2024-01-15", etc.
    // This is a "Fast" implementation using Regex. PRO mode could use AI.
    const dateRegex = /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)|(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
    const keywords = ['exam', 'test', 'submission', 'deadline', 'quiz', 'midsem', 'endsem', 'viva'];

    lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        if (keywords.some(k => lowerLine.includes(k))) {
            const match = line.match(dateRegex);
            if (match) {
                // Heuristic: If we found a date + keyword, assume it's an event.
                // We default to "All Day" event for now.
                const dateStr = match[0];
                // In a real app, we'd use a robust date parser (e.g. chrono-node). 
                // For this, we'll try basic JS parse.
                const date = new Date(dateStr);

                if (!isNaN(date.getTime())) {
                    events.push({
                        title: `📚 SemesterScan: ${line.substring(0, 50)}...`,
                        description: `Original Chat: ${line}`,
                        start: [date.getFullYear(), date.getMonth() + 1, date.getDate()],
                        duration: { hours: 1 }
                    });
                }
            }
        }
    });

    if (events.length === 0) return null;

    const { error, value } = createEvents(events);
    if (error) {
        console.error("ICS Gen Error:", error);
        return null;
    }
    return new Blob([value], { type: 'text/calendar' });
}

/**
 * Extract exam events as structured data (for displaying in UI)
 */
export function getExamEvents(chatContent) {
    const lines = chatContent.split('\n');
    const events = [];

    const dateRegex = /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)|(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
    const keywords = ['exam', 'test', 'submission', 'deadline', 'quiz', 'midsem', 'endsem', 'viva'];

    lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        if (keywords.some(k => lowerLine.includes(k))) {
            const match = line.match(dateRegex);
            if (match) {
                const dateStr = match[0];
                const date = new Date(dateStr);

                if (!isNaN(date.getTime())) {
                    events.push({
                        title: line.substring(0, 100).trim(),
                        date: date,
                        dateStr: date.toLocaleDateString(),
                        googleCalendarUrl: generateGoogleCalendarUrl(line.substring(0, 50), date)
                    });
                }
            }
        }
    });

    return events;
}

/**
 * Generate a Google Calendar URL for adding an event
 */
function generateGoogleCalendarUrl(title, date) {
    const startDate = date.toISOString().replace(/-|:|\.\d+/g, '').slice(0, 8);
    const endDate = startDate; // Same day event

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `📚 ${title}...`,
        dates: `${startDate}/${endDate}`,
        details: 'Added from SemesterScan',
        sf: 'true'
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Sync events directly to Google Calendar via API
 * @param {Array} events - List of event objects (title, date)
 * @param {string} accessToken - OAuth access token
 */
export async function syncEventsToGoogleCalendar(events, accessToken) {
    if (!accessToken) return { success: false, error: "Not successfully signed in" };

    let addedCount = 0;
    const errors = [];

    for (const event of events) {
        // Format date for API (YYYY-MM-DD)
        const dateStr = event.date.toISOString().split('T')[0];

        const eventBody = {
            summary: `📚 ${event.title}`,
            description: 'Added via SemesterScan',
            start: { date: dateStr },
            end: { date: dateStr } // All day event
        };

        try {
            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventBody)
            });

            if (response.ok) {
                addedCount++;
            } else {
                const err = await response.json();
                console.error('Calendar sync error:', err);
                errors.push(err.error?.message || 'Unknown error');
            }
        } catch (e) {
            console.error('Network error syncing event:', e);
            errors.push(e.message);
        }
    }

    return {
        success: addedCount > 0,
        added: addedCount,
        total: events.length,
        errors: errors
    };
}

/**
 * Generates a Study Brief using the Gemini API.
 * This is a PRO Mode feature.
 */
export async function generateStudyBrief(files, apiKey) {
    // Only take top 10 academic files to summarize
    const topFiles = files
        .filter(f => f.category !== 'Junk' && f.category !== 'Admin')
        .slice(0, 10);

    const fileList = topFiles.map(f => `- ${f.fileName} (${f.subject}): ${f.category}`).join('\n');

    const prompt = `
    You are an academic assistant. Based on this list of semester files, generate a "Study Brief" (Markdown).
    
    Files:
    ${fileList}

    Tasks:
    1. Summarize the key subjects found.
    2. Suggest a rough study order (Start with X, then Y).
    3. Identify any missing critical topics based on common curriculum (e.g. if Calculus I is there, is II missing?).
    
    Keep it concise (1 page).
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        console.error("Study Brief Error:", e);
        return "Failed to generate study brief. Please check your API key/quota.";
    }
}
