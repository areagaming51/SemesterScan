
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
