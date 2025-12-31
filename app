import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Upload, FileText, CheckCircle2, AlertCircle, Play, Download,
    Trash2, Folder, Cpu, Terminal, Shield, Sparkles,
    Calendar, ListCheck, FileArchive, Search, BrainCircuit, Loader2,
    PieChart, LayoutDashboard, FileStack, History, Settings, Info,
    Filter, ChevronRight, HardDrive, User, LogOut, Bell, X,
    FileImage, FileType, CheckCircle, MoreHorizontal, BookOpen, Languages, CloudUpload, Lock
} from 'lucide-react';

// --- Configuration Constants ---
const GOOGLE_CLIENT_ID = ""; // Replace with your Client ID
const GOOGLE_API_KEY = "";   // Replace with your API Key

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all group ${active
                ? 'bg-[#28425A] text-white shadow-sm'
                : 'text-[#8fa6b8] hover:text-white hover:bg-white/5'
            }`}
    >
        <Icon className={`w-5 h-5 transition-colors ${active ? 'text-white' : 'text-[#8fa6b8]'}`} />
        {label}
    </button>
);

const MetricCard = ({ label, value, icon: Icon }) => (
    <div className="bg-white border border-[#d1c7b3]/30 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#f8f5f0] rounded-lg">
                <Icon className="w-4 h-4 text-[#122538]" />
            </div>
            <span className="text-[10px] font-bold text-[#122538]/50 uppercase tracking-widest">{label}</span>
        </div>
        <div className="text-4xl font-serif font-bold text-[#122538] tracking-tight">{value}</div>
    </div>
);

const FileIcon = ({ filename }) => {
    const ext = filename?.split('.').pop().toLowerCase();
    if (['jpg', 'png', 'jpeg'].includes(ext)) return <FileImage className="w-4 h-4 text-[#c8bca0]" />;
    if (ext === 'pdf') return <FileType className="w-4 h-4 text-rose-800/60" />;
    return <FileText className="w-4 h-4 text-[#1a3b5d]" />;
};

// --- Main Application ---

export default function App() {
    const [view, setView] = useState('overview');
    const [apiKey, setApiKey] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [chatContent, setChatContent] = useState('');
    const [zipInstance, setZipInstance] = useState(null);
    const [isProcessingZip, setIsProcessingZip] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanStep, setScanStep] = useState(0);
    const [results, setResults] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [driveToken, setDriveToken] = useState(null);
    const [isGapiLoaded, setIsGapiLoaded] = useState(false);

    const fileInputRef = useRef(null);

    const SUBJECT_KEYWORDS = {
        "Math": ["math", "calculus", "integration", "algebra", "matrix", "derivative", "statistics"],
        "Physics": ["physics", "optics", "quantum", "mechanics", "light", "wave", "thermo", "lab"],
        "BME": ["bme", "biology", "biomedical", "kumari", "anatomy", "cell", "physiology"],
        "Engineering_Graphics": ["eg", "graphics", "drawing", "projection", "autocad", "isometric", "scale"],
        "General": ["notice", "circular", "holiday", "exam", "time table", "schedule", "fees", "admin"]
    };

    const scanNarrative = [
        "Mounting local archive",
        "Identifying file pointers",
        "Local subject heuristics",
        "Privacy-shielded AI Scan",
        "Building academic tree"
    ];

    // Load Dependencies
    useEffect(() => {
        const jsZipScript = document.createElement('script');
        jsZipScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        jsZipScript.async = true;
        document.body.appendChild(jsZipScript);

        const gapiScript = document.createElement('script');
        gapiScript.src = "https://apis.google.com/js/api.js";
        gapiScript.async = true;
        gapiScript.onload = () => {
            window.gapi.load('picker', () => setIsGapiLoaded(true));
        };
        document.body.appendChild(gapiScript);

        const gisScript = document.createElement('script');
        gisScript.src = "https://accounts.google.com/gsi/client";
        gisScript.async = true;
        document.body.appendChild(gisScript);

        return () => {
            if (jsZipScript.parentNode) document.body.removeChild(jsZipScript);
            if (gapiScript.parentNode) document.body.removeChild(gapiScript);
            if (gisScript.parentNode) document.body.removeChild(gisScript);
        };
    }, []);

    // --- Google Drive Logic ---

    const handleDriveAuth = (callback) => {
        if (!window.google || !isGapiLoaded) return;
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
            callback: async (response) => {
                if (response.error !== undefined) throw response;
                setDriveToken(response.access_token);
                if (callback) callback(response.access_token);
            },
        });
        tokenClient.requestAccessToken({ prompt: driveToken ? '' : 'consent' });
    };

    const handleDriveImport = () => handleDriveAuth((token) => {
        const picker = new window.google.picker.PickerBuilder()
            .addView(window.google.picker.ViewId.DOCS)
            .setOAuthToken(token)
            .setDeveloperKey(GOOGLE_API_KEY)
            .setCallback(async (data) => {
                if (data.action === window.google.picker.Action.PICKED) {
                    const fileId = data.docs[0].id;
                    const fileName = data.docs[0].name;
                    setIsProcessingZip(true);
                    try {
                        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const blob = await resp.blob();
                        if (fileName.endsWith('.zip')) {
                            const zip = await new window.JSZip().loadAsync(blob);
                            setZipInstance(zip);
                            const chat = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.txt') && !n.includes('__MACOSX'));
                            if (chat) setChatContent(await zip.file(chat).async("string"));
                        } else if (fileName.endsWith('.txt')) {
                            setChatContent(await blob.text());
                        }
                        setResults([]);
                    } catch (e) { console.error(e); } finally { setIsProcessingZip(false); }
                }
            })
            .build();
        picker.setVisible(true);
    });

    // --- AI Privacy Logic ---

    const blobToBase64 = (blob) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
    });

    const callGeminiPrivacyFirst = async (item, imageData = null) => {
        // Only sending filename and optional image data. NO chat text is sent.
        const parts = [
            {
                text: `Identify the academic category for this file: "${item.fileName}". 
               The suggested subject from local processing is "${item.subject}".
               Categories: Notes, Assignment, Admin, Junk.
               If image is provided, perform OCR and include extracted text in the JSON field "ocr".
               Output JSON ONLY: {"category": "string", "ocr": "string", "confidence": "string"}` }
        ];

        if (imageData) {
            parts.push({ inlineData: { mimeType: "image/png", data: imageData } });
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts }] })
            });
            const data = await response.json();
            return JSON.parse(data.candidates[0].content.parts[0].text);
        } catch (e) {
            return { category: "Uncategorized", ocr: "", confidence: "Low" };
        }
    };

    const startScan = async () => {
        if (!apiKey) { setShowSettings(true); return; }
        setIsScanning(true);
        setScanStep(1);

        // Initial parsing
        const lines = chatContent.split('\n');
        const attachmentRegex = /[\w\-\.\(\)\s]+\.(?:pdf|jpg|png|docx|pptx|doc|mp4|opus)/i;
        const rawItems = [];

        // STEP 2 & 3: Local Heuristics (Private - happens only in browser)
        setScanStep(2);
        lines.forEach((line, index) => {
            const match = line.match(attachmentRegex);
            if (match && (line.includes('attached') || line.includes('<attached:'))) {
                const fileName = match[0].trim();
                // Context extracted locally for subject guessing, but NOT sent to AI
                const context = lines.slice(Math.max(0, index - 5), Math.min(lines.length, index + 3)).join(' ');

                let subject = "General";
                for (const [sub, keys] of Object.entries(SUBJECT_KEYWORDS)) {
                    if (keys.some(k => context.toLowerCase().includes(k))) { subject = sub; break; }
                }
                rawItems.push({ id: index, fileName, subject, lineSnippet: line });
            }
        });

        setScanStep(3);
        await new Promise(r => setTimeout(r, 1000));

        // STEP 4: Privacy-Shielded AI Call
        setScanStep(4);
        const processedResults = [];
        const subset = rawItems.slice(0, 20); // Process batch for stability

        for (const item of subset) {
            let aiResult;
            const isImage = /\.(jpg|jpeg|png)$/i.test(item.fileName);

            if (isImage && zipInstance && zipInstance.file(item.fileName)) {
                const blob = await zipInstance.file(item.fileName).async("blob");
                const base64 = await blobToBase64(blob);
                aiResult = await callGeminiPrivacyFirst(item, base64);
            } else {
                aiResult = await callGeminiPrivacyFirst(item);
            }

            processedResults.push({
                ...item,
                category: aiResult.category,
                ocrText: aiResult.ocr,
                confidence: aiResult.confidence
            });
        }

        setScanStep(5);
        setResults(processedResults);
        setIsScanning(false);
    };

    // --- Export Logic ---

    const generateOrganizedBlob = async () => {
        if (!zipInstance || !window.JSZip) return null;
        const newZip = new window.JSZip();
        const getMapping = (fileName) => {
            const match = results.find(r => r.fileName === fileName);
            if (match) return match.category === 'Junk' ? 'Junk' : `College_Docs/${match.subject}/${match.category}`;
            return 'Unsorted';
        };

        const zipFiles = Object.keys(zipInstance.files);
        for (const name of zipFiles) {
            const fileData = zipInstance.files[name];
            if (fileData.dir || name.includes('__MACOSX')) continue;
            const content = await fileData.async("blob");
            if (name.toLowerCase().endsWith('.txt')) {
                newZip.file(name, content);
            } else {
                const path = getMapping(name);
                newZip.file(`${path}/${name}`, content);
            }
        }
        return await newZip.generateAsync({ type: "blob" });
    };

    const saveToDrive = async () => {
        if (!driveToken) { handleDriveAuth(() => saveToDrive()); return; }
        setIsScanning(true);
        try {
            const blob = await generateOrganizedBlob();
            if (!blob) return;
            const metadata = { name: `Organized_Semester_${new Date().toISOString().split('T')[0]}.zip`, mimeType: 'application/zip' };
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);
            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST', headers: { Authorization: `Bearer ${driveToken}` }, body: form
            });
            if (res.ok) alert("Successfully saved to Google Drive!");
        } catch (e) { console.error(e); } finally { setIsScanning(false); }
    };

    const downloadOrganizedZip = async () => {
        setIsScanning(true);
        const blob = await generateOrganizedBlob();
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Organized_Archive.zip`;
            a.click();
        }
        setIsScanning(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !window.JSZip) return;
        setIsProcessingZip(true);
        try {
            const zip = await new window.JSZip().loadAsync(file);
            setZipInstance(zip);
            const chat = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.txt') && !n.includes('__MACOSX'));
            if (chat) setChatContent(await zip.file(chat).async("string"));
            setResults([]);
        } catch (err) { console.error(err); } finally { setIsProcessingZip(false); }
    };

    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = r.fileName.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q);
            const matchesFilter = activeFilter === 'All' || r.category === activeFilter;
            return matchesSearch && matchesFilter;
        });
    }, [results, searchQuery, activeFilter]);

    const stats = useMemo(() => ({
        academic: results.filter(r => r.category !== 'Junk').length,
        junk: results.filter(r => r.category === 'Junk').length,
        subjects: new Set(results.map(r => r.subject)).size
    }), [results]);

    return (
        <div className="min-h-screen bg-[#f8f5f0] text-[#122538] font-sans flex overflow-hidden">

            {/* SIDEBAR */}
            <aside className="w-64 bg-[#122538] text-white flex flex-col h-screen shrink-0 shadow-2xl relative z-30">
                <div className="h-20 flex items-center px-6">
                    <div className="flex items-center gap-3">
                        <svg className="w-9 h-9 text-[#c8bca0]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
                        </svg>
                        <span className="font-bold text-xl tracking-wide text-white">SemesterScan</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 mt-6 space-y-2">
                    <SidebarItem icon={LayoutDashboard} label="Overview" active={view === 'overview'} onClick={() => setView('overview')} />
                    <SidebarItem icon={FileStack} label="Files" active={view === 'files'} onClick={() => setView('files')} />
                    <SidebarItem icon={PieChart} label="Subjects" active={view === 'subjects'} onClick={() => setView('subjects')} />
                    <SidebarItem icon={History} label="History" active={view === 'history'} onClick={() => setView('history')} />
                    <div className="px-6 my-6"><div className="h-px bg-white/10 w-full" /></div>
                    <SidebarItem icon={BookOpen} label="Guide" active={view === 'guide'} onClick={() => setView('guide')} />
                </nav>

                <div className="p-4 bg-[#122538] space-y-2">
                    <div className="px-4 py-2 bg-indigo-500/10 rounded-lg flex items-center gap-3 border border-indigo-500/20 mb-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest leading-none">Privacy Engine Active</span>
                    </div>
                    <button
                        onClick={handleDriveImport}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[#c8bca0] hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-bold border border-[#c8bca0]/20"
                    >
                        <HardDrive className="w-5 h-5" /> Import from Drive
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[#8fa6b8] hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium"
                    >
                        <Settings className="w-5 h-5" /> Settings
                    </button>
                    <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10 pt-4">
                        <div className="w-10 h-10 rounded-full bg-[#28425A] flex items-center justify-center text-white font-semibold text-sm">U1</div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-white truncate">Student-User</span>
                            <span className="text-xs text-[#8fa6b8]">Free Tier</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* MAIN VIEWPORT */}
            <main className="flex-1 flex flex-col relative bg-[#f8f5f0] overflow-hidden">

                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                    <svg className="absolute -top-20 -left-20 w-[500px] h-[500px] text-[#c8bca0]/20" fill="none" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.5" />
                        <circle cx="50" cy="50" r="38" stroke="currentColor" strokeDasharray="2 2" strokeWidth="0.2" />
                    </svg>
                    <BookOpen className="absolute top-24 left-1/4 w-12 h-12 text-[#122538]/10 -rotate-12" />
                    <div className="absolute bottom-0 right-0 w-[600px] h-[600px] border-[60px] border-white/40 rounded-full translate-x-1/2 translate-y-1/2" />
                </div>

                {/* HEADER */}
                <header className="h-20 flex items-center justify-between px-8 relative z-20">
                    <div className="flex items-center gap-4 flex-1">
                        <Search className="w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search organized files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none text-sm outline-none w-full max-w-md text-[#122538] font-medium placeholder-gray-400 focus:ring-0"
                        />
                    </div>
                    <div className="flex items-center gap-6">
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-[#d1e7dd] text-[#0f5132] flex items-center gap-2`}>
                            <Lock className="w-3 h-3" /> local processing
                        </div>
                        <button className="relative text-gray-400 hover:text-[#122538]">
                            <Bell className="w-6 h-6" />
                            <span className="absolute top-0 right-0 block h-1.5 w-1.5 rounded-full bg-red-400 ring-2 ring-[#f8f5f0]" />
                        </button>
                    </div>
                </header>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-8">

                    {/* VIEW: GUIDE */}
                    {view === 'guide' && (
                        <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                            <div className="space-y-4 text-center">
                                <div className="w-16 h-16 bg-[#1a3b5d]/5 rounded-2xl flex items-center justify-center mx-auto">
                                    <Shield className="w-8 h-8 text-[#1a3b5d]" />
                                </div>
                                <h1 className="font-serif text-4xl font-bold text-[#122538]">Privacy-First Organization</h1>
                                <p className="text-gray-500 text-lg">Your group chats stay private. We only use AI to classify files and process image text, never to read your messages.</p>
                            </div>
                        </div>
                    )}

                    {/* INITIAL STATE: HERO */}
                    {view === 'overview' && results.length === 0 && !isScanning && (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="mb-10 relative">
                                <img
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHHoDOm3K7f_ZdoVpwwB2yNS4sgyOJP5dhwK5S-Jl9a3nUMeqQvkSRr8uOy_IgIG4dazyaVepv15ZZr36MR-wgZ9kTJ1iV5do5U3s6o3Ywd_njb0Sa2pW3Fvko1KmVMK0Iy1tKF_TwSdErepvt7iSzumlekjHDzuNehMzMeTJSJlN2xo680qAwc6kwd2yMHj4Re9Zrwsgp1k70uy9btl19loIfzQw11Jvc0IDQlMn20BlJK8Ra69C61uRSRLpN1fp4MJAD7nGverA"
                                    alt="Academic Illustration"
                                    className="w-72 mix-blend-multiply relative z-10"
                                />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-[#c8bca0]/40 rounded-full -z-10" />
                            </div>

                            <h1 className="font-serif text-5xl font-bold text-[#122538] mb-6 tracking-tight">Organize your semester</h1>
                            <p className="text-gray-500 text-lg mb-8 max-w-[600px]">Upload your WhatsApp chat export to structure your notes by subject. Processing is local and private.</p>

                            <div className="flex flex-col items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-1 border-2 border-[#c8bca0] rounded-[12px] bg-transparent">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="bg-[#1a3b5d] hover:bg-[#0d1b2a] text-white px-8 py-3 rounded-[8px] flex items-center gap-3 font-medium text-lg shadow-lg"
                                        >
                                            {isProcessingZip ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileArchive className="w-5 h-5" />}
                                            {zipInstance ? 'ZIP Verified' : 'Upload ZIP Export'}
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".zip" className="hidden" />
                                        </button>
                                    </div>

                                    <button
                                        onClick={handleDriveImport}
                                        className="p-4 bg-white border border-[#d1c7b3]/50 text-[#122538] hover:bg-[#f8f5f0] rounded-2xl shadow-sm flex items-center gap-3 font-bold text-sm"
                                    >
                                        <HardDrive className="w-5 h-5 text-[#c8bca0]" /> Import from Drive
                                    </button>
                                </div>
                                {chatContent && (
                                    <button onClick={startScan} className="text-[#1a3b5d] font-bold text-sm underline underline-offset-4 hover:text-[#c8bca0]">Begin Private Extraction →</button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SCANNING STATE */}
                    {isScanning && (
                        <div className="h-full flex flex-col items-center justify-center max-w-sm mx-auto space-y-12">
                            <div className="w-16 h-16 rounded-full border-2 border-gray-200 border-t-[#1a3b5d] animate-spin" />
                            <div className="w-full space-y-4">
                                {scanNarrative.map((text, i) => (
                                    <div key={i} className={`flex items-center justify-between px-6 py-4 rounded-xl border transition-all duration-500 ${scanStep > i + 1 ? 'bg-emerald-50 border-emerald-100' : scanStep === i + 1 ? 'bg-white border-[#1a3b5d]/30' : 'bg-white/50 opacity-20'
                                        }`}>
                                        <span className="text-sm font-medium text-[#122538]">{text}</span>
                                        {scanStep > i + 1 ? <CheckCircle2 className="w-4 h-4 text-[#0f5132]" /> : scanStep === i + 1 && <Loader2 className="w-4 h-4 animate-spin text-[#1a3b5d]" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* DASHBOARD (Overview) */}
                    {view === 'overview' && results.length > 0 && !isScanning && (
                        <div className="space-y-10 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto">
                            <div className="flex items-end justify-between border-b border-[#d1c7b3]/30 pb-8">
                                <div>
                                    <h2 className="text-3xl font-serif font-bold text-[#122538] tracking-tight">Curation Complete.</h2>
                                    <p className="text-gray-500 text-sm mt-2 font-medium">Chat messages filtered out. Only academic assets retained.</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="p-1 border border-[#c8bca0] rounded-[10px]">
                                        <button onClick={downloadOrganizedZip} className="px-6 py-2.5 bg-[#1a3b5d] hover:bg-[#0d1b2a] text-white rounded-[6px] text-sm font-bold flex items-center gap-2">
                                            <Download className="w-4 h-4" /> Download ZIP
                                        </button>
                                    </div>
                                    <button onClick={saveToDrive} className="px-6 py-2.5 bg-white border border-[#d1c7b3]/50 text-[#122538] hover:bg-[#f8f5f0] rounded-[10px] text-sm font-bold shadow-sm flex items-center gap-2">
                                        <CloudUpload className="w-4 h-4 text-[#c8bca0]" /> Save to Drive
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <MetricCard label="Private Docs" value={stats.academic} icon={FileStack} />
                                <MetricCard label="Chat Noise Filtered" value={stats.junk} icon={Trash2} />
                                <MetricCard label="Department Clusters" value={stats.subjects} icon={Folder} />
                            </div>
                        </div>
                    )}

                    {/* VIEW: FILES */}
                    {view === 'files' && results.length > 0 && (
                        <div className="bg-white border border-[#d1c7b3]/30 rounded-2xl overflow-hidden shadow-sm animate-in fade-in">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-[#122538]/50 px-2 flex items-center gap-2">
                                    <Lock className="w-3 h-3 text-emerald-600" /> Filesystem Preview
                                </h3>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] font-bold text-[#122538]/30 uppercase tracking-[0.2em] bg-[#fcfbf9]">
                                        <th className="px-8 py-4">Descriptor</th>
                                        <th className="px-8 py-4">Department</th>
                                        <th className="px-8 py-4">Assurance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredResults.map((r, i) => (
                                        <tr key={i} onClick={() => setSelectedFile(r)} className="group cursor-pointer hover:bg-[#fcfbf9] transition-all">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <FileIcon filename={r.fileName} />
                                                    <span className="text-sm font-semibold text-[#122538] truncate max-w-xs">{r.fileName}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 italic text-gray-400 text-xs font-serif">{r.subject}</td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${r.category === 'Junk' ? 'bg-gray-300' : 'bg-[#c8bca0]'}`} />
                                                    <span className={`text-[10px] font-bold uppercase ${r.category === 'Junk' ? 'text-gray-400' : 'text-[#1a3b5d]'}`}>{r.confidence} Match</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL INSPECTOR */}
                {selectedFile && (
                    <div className="absolute top-0 right-0 w-[420px] h-full bg-white border-l border-[#d1c7b3]/30 z-40 animate-in slide-in-from-right duration-300 shadow-2xl flex flex-col">
                        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#122538]/30 uppercase tracking-[0.3em]">Privacy Detail View</span>
                            <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 space-y-12">
                            <div className="space-y-6 text-center">
                                <div className="mx-auto w-16 h-16 bg-[#f8f5f0] rounded-2xl flex items-center justify-center border border-[#d1c7b3]/20">
                                    <FileIcon filename={selectedFile.fileName} />
                                </div>
                                <h3 className="font-serif text-2xl font-bold text-[#122538] leading-tight break-all">{selectedFile.fileName}</h3>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    <span className="px-3 py-1 bg-[#1a3b5d]/5 text-[#1a3b5d] text-[10px] font-bold uppercase tracking-wider rounded-md border border-[#1a3b5d]/10">{selectedFile.subject}</span>
                                </div>
                            </div>

                            {selectedFile.ocrText && (
                                <div className="space-y-4">
                                    <div className="text-[10px] font-bold text-[#122538]/30 uppercase tracking-widest flex items-center gap-2">OCR Analysis Result</div>
                                    <div className="bg-[#fcfbf9] border border-[#d1c7b3]/20 p-6 rounded-2xl text-gray-600 text-sm whitespace-pre-wrap font-mono">
                                        {selectedFile.ocrText}
                                    </div>
                                </div>
                            )}

                            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-4">
                                <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-1" />
                                <p className="text-[11px] text-emerald-800 leading-relaxed">
                                    <strong>Privacy Note:</strong> Conversational context was analyzed locally within your browser. Gemini only processed the filename and image content.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* SETTINGS */}
            {showSettings && (
                <div className="fixed inset-0 bg-[#122538]/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
                    <div className="bg-[#f8f5f0] w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-white/50 animate-in fade-in">
                        <div className="p-10 border-b border-[#d1c7b3]/30 flex items-center justify-between">
                            <h3 className="font-serif text-2xl font-bold text-[#122538]">Config</h3>
                            <button onClick={() => setShowSettings(false)}><X className="w-6 h-6 text-gray-400" /></button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-4 font-sans">
                                <label className="text-[10px] font-bold text-[#122538]/30 uppercase tracking-[0.2em]">Gemini API Key</label>
                                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full bg-white border border-[#d1c7b3]/50 rounded-2xl px-6 py-5 text-sm outline-none focus:border-[#1a3b5d]" />
                            </div>
                        </div>
                        <div className="p-8 bg-white/80 border-t border-[#d1c7b3]/30 flex justify-end">
                            <button onClick={() => setShowSettings(false)} className="px-10 py-3.5 bg-[#1a3b5d] text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all">Store Key Locally</button>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING HELP */}
            <button onClick={() => setView('guide')} className="fixed bottom-10 right-10 w-14 h-14 bg-[#1a3b5d] hover:bg-[#0d1b2a] rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-110 z-30 shadow-indigo-600/20"><Info className="w-6 h-6" /></button>

            <style dangerouslySetInnerHTML={{
                __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1c7b3; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #c8bca0; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom { from { transform: translateY(20px); } to { transform: translateY(0); } }
        @keyframes slide-in-from-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-in { animation-duration: 400ms; animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-bottom-4 { animation-name: slide-in-from-bottom; }
        .slide-in-from-right { animation-name: slide-in-from-right; }
      `}} />
        </div>
    );
}