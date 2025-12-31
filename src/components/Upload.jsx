import { useRef, useState } from 'react';
import { FileArchive, UploadCloud, KeyRound } from 'lucide-react';
import JSZip from 'jszip';
import { GoogleGenerativeAI } from '@google/generative-ai';

export function Upload({ onStart, onFinish }) {
    const inputRef = useRef(null);
    const [apiKey, setApiKey] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const handleProcess = async (file) => {
        if (!file || !apiKey) {
            if (!apiKey) alert('Please enter your Gemini API Key first.');
            return;
        }

        onStart();

        try {
            // 1. Load the ZIP
            const zip = await JSZip.loadAsync(file);
            const newZip = new JSZip();

            // 2. Initialize Gemini
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Using 1.5 as 2.5 might not be in generic library yet, or fallback to reliable

            // 3. Iterate
            const entries = Object.values(zip.files);

            // Create folder structure map
            const OrganizedFolders = {
                'Math': newZip.folder('Math'),
                'Physics': newZip.folder('Physics'),
                'Chemistry': newZip.folder('Chemistry'),
                'Biology': newZip.folder('Biology'),
                'Engineering': newZip.folder('Engineering'),
                'Humanities': newZip.folder('Humanities'),
                'Other': newZip.folder('Other'),
                'Junk': newZip.folder('Junk')
            };

            for (const entry of entries) {
                if (entry.dir) continue;

                const isAttachment = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|txt)$/i.test(entry.name);

                if (!isAttachment) {
                    // Skip system files or unknown junk
                    continue;
                }

                const content = await entry.async('blob');

                // Simple heuristic + AI for file naming/classification
                // In a real app, we'd look for a chat log file to find context.
                // Here, we'll try to guess based on filename if it has words, otherwise default to 'Other' if generic.
                // Ideally, we prompt Gemini with the filename.

                let subject = 'Other';
                if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
                    // It's an image. Let's assume it might be notes.
                    // We won't burn tokens on every single image for this demo unless we want to be fancy.
                    // Let's do a quick check.
                    subject = 'Other';
                }

                // AI Classification Step
                try {
                    const prompt = `
                    You are an academic file organizer.
                    Filename: "${entry.name}"
                    
                    Classify this file into one of these exact categories: [Math, Physics, Chemistry, Biology, Engineering, Humanities, Junk, Other].
                    If the filename looks like a meme or sticker (e.g. "sticker.webp", "meme_23.jpg"), classify as Junk.
                    If strictly academic but unclear, use Other.
                    Return ONLY the category name.
                `;

                    // Rate limiting protection (simple delay)
                    await new Promise(r => setTimeout(r, 200));

                    const result = await model.generateContent(prompt);
                    const text = result.response.text().trim();

                    // Clean up response
                    const cleanSubject = text.replace(/[^a-zA-Z]/g, '');

                    if (OrganizedFolders[cleanSubject]) {
                        subject = cleanSubject;
                    }
                } catch (e) {
                    console.warn('AI classification failed for', entry.name, e);
                    subject = 'Other';
                }

                // Add to new zip
                if (subject !== 'Junk') {
                    newZip.folder(subject).file(entry.name, content);
                }
            }

            // 4. Generate
            const outBlob = await newZip.generateAsync({ type: 'blob' });
            const downloadUrl = URL.createObjectURL(outBlob);
            onFinish(downloadUrl);

        } catch (err) {
            console.error(err);
            alert('Error processing zip: ' + err.message);
            onFinish(null); // Reset
        }
    };

    return (
        <div className="w-full space-y-8">
            {/* API Key Input */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                    <KeyRound className="w-4 h-4 text-indigo-400" />
                    Gemini API Key
                </label>
                <input
                    type="password"
                    placeholder="Paste your API key here (sk-...)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-slate-500 mt-2">
                    Your key is used locally in your browser and never saved to any server.
                </p>
            </div>

            {/* Drop Zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) handleProcess(e.dataTransfer.files[0]);
                }}
                className={`
                group relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ease-out
                flex flex-col items-center justify-center text-center gap-4 cursor-pointer
                ${isDragging
                        ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02]'
                        : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600'
                    }
            `}
            >
                <input
                    type="file"
                    accept=".zip"
                    ref={inputRef}
                    onChange={(e) => handleProcess(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className={`
                p-4 rounded-full bg-slate-800 border border-slate-700 shadow-xl mb-2 group-hover:scale-110 transition-transform duration-300
                ${isDragging ? 'bg-indigo-600 border-indigo-500' : ''}
            `}>
                    <FileArchive className={`w-8 h-8 ${isDragging ? 'text-white' : 'text-indigo-400'}`} />
                </div>

                <div className="space-y-1">
                    <p className="text-xl font-medium text-white group-hover:text-indigo-200 transition-colors">
                        Click or drag WhatsApp .zip here
                    </p>
                    <p className="text-sm text-slate-400">
                        Supports exports with media
                    </p>
                </div>
            </div>
        </div>
    );
}
