/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, apiRequest } from '@/lib/apiClient';
import { useAuthState } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
    Activity,
    AlertTriangle,
    Book, Bot, Calendar,
    Check, ChevronRight, CircleDollarSign,
    ClipboardCopy,
    Clock,
    Code2,
    Copy,
    Eye, EyeOff, Flame, Gauge, Globe, History,
    ImageIcon,
    Info, Key, Layers, Loader2, MessageSquare,
    Mic,
    MicOff,
    RefreshCw,
    Send,
    Server,
    ShieldCheck,
    Tag, Terminal, Timer, TrendingDown,
    Wrench, X, Zap
} from 'lucide-react';
import React, { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModelConfig {
    id: string;
    owned_by: string;
    display_name: string;
    description: string;
    category: string;
    context_window: number;
    max_output_tokens: number;
    supports_streaming: boolean;
    supports_vision: boolean;
    supports_tool_calling: boolean;
    pricing: { input_credits_per_1k_tokens: number; output_credits_per_1k_tokens: number };
    tags: string[];
    rate_limits: { rpm: number | null; rpd: number | null };
}

interface ProviderMetadata { label: string; color: string; icon: string }

interface ModelsResponse {
    object: string;
    data: ModelConfig[];
    total: number;
    providers: Record<string, ProviderMetadata>;
    stats: Record<string, number>;
}

interface GatewayBalance { success: boolean; data: { credits: number; userId: string } }

interface UsageStats {
    success: boolean;
    data: {
        period: string;
        summary: { totalRequests: number; totalCreditsUsed: number; totalTokens: number; promptTokens: number; completionTokens: number; averageLatencyMs: number };
        modelBreakdown: Array<{ model: string; provider: string; requests: number; creditsUsed: number; tokens: number }>;
        recentRequests: Array<{ id: string; model: string; provider: string; promptTokens: number; completionTokens: number; creditsUsed: number; latencyMs: number; streaming: boolean; cached: boolean; status: string; createdAt: string }>;
    };
}

interface ApiKeysResponse { success: boolean; data: Array<{ id: string; name: string; prefix: string; lastUsedAt?: string }> }

interface ModelStatusEntry {
    modelId: string;
    displayName: string;
    provider: string;
    category: string;
    status: 'operational' | 'degraded' | 'outage' | 'unknown';
    latencyMs: number | null;
    checkedAt: string | null;
    uptimePercent: number;
    errorMessage?: string;
    supportsVision: boolean;
    supportsToolCalling: boolean;
    metrics?: {
        p50: number | null;
        p95: number | null;
        min: number | null;
        max: number | null;
    };
}

interface Incident {
    startedAt: string;
    resolvedAt?: string;
    errorMessage: string;
    provider: string;
}

interface StatusResponse {
    success: boolean;
    data: {
        models: ModelStatusEntry[];
        probeRanAt: string | null;
        incidentHistory: Incident[];
    };
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    image?: string;          // base64 data URL for vision
    usage?: {
        totalTokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        creditsUsed?: number;
        x_fairarena?: { credits_used: number };
    };
    thought?: string;
    latencyMs?: number;
    error?: boolean;
    timestamp: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
    fast: { label: 'Fast', icon: '⚡', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    balanced: { label: 'Balanced', icon: '⚖️', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    powerful: { label: 'Powerful', icon: '🔥', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
    vision: { label: 'Vision', icon: '👁️', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    coding: { label: 'Coding', icon: '💻', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
    reasoning: { label: 'Reasoning', icon: '🧠', color: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
    'image-generation': { label: 'Image Gen', icon: '🎨', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    embedding: { label: 'Embeddings', icon: '📐', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
    safety: { label: 'Safety', icon: '🛡️', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

// ── Components ───────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className={cn('p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground', className)} title="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
        </button>
    );
}

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
    return (
        <div className="relative group rounded-lg border bg-muted/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <span className="text-xs font-mono text-muted-foreground">{lang}</span>
                <CopyButton text={code} />
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto text-foreground/90 leading-relaxed whitespace-pre-wrap">{code}</pre>
        </div>
    );
}

function CategoryBadge({ category }: { category: string }) {
    const meta = CATEGORY_META[category] ?? { label: category, icon: '○', color: 'bg-secondary text-foreground border-border' };
    return (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium', meta.color)}>
            <span>{meta.icon}</span>{meta.label}
        </span>
    );
}

/** Render markdown-like content: code blocks, bold, inline code */
function MarkdownContent({ text }: { text: string }) {
    const parts: React.ReactNode[] = [];
    const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRe.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(<InlineMarkdown key={`t${lastIndex}`} text={text.slice(lastIndex, match.index)} />);
        }
        const lang = match[1] || 'code';
        const code = match[2].trimEnd();
        parts.push(
            <div key={`cb${match.index}`} className="my-3">
                <CodeBlock code={code} lang={lang} />
            </div>
        );
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push(<InlineMarkdown key={`t${lastIndex}`} text={text.slice(lastIndex)} />);
    }
    return <div className="space-y-1.5">{parts}</div>;
}

/** Component to display the AI's "thinking" process */
function ThoughtProcess({ thought }: { thought: string }) {
    const [isExpanded, setIsExpanded] = useState(true);
    if (!thought.trim()) return null;

    return (
        <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.03] overflow-hidden transition-all animate-in fade-in slide-in-from-top-2">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-2 bg-violet-500/5 hover:bg-violet-500/10 transition-colors"
            >
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-500/80">
                    <Timer className={cn("h-3 w-3", isExpanded && "animate-pulse")} />
                    <span>Thought Process</span>
                </div>
                <div className="px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 text-[8px] font-mono">
                    {thought.length.toLocaleString()} chars
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 pt-1 text-xs text-muted-foreground/90 font-serif italic leading-relaxed whitespace-pre-wrap border-t border-violet-500/10 bg-gradient-to-b from-transparent to-violet-500/[0.02]">
                    {thought.trim()}
                </div>
            )}
        </div>
    );
}

function InlineMarkdown({ text }: { text: string }) {
    // Bold and inline code
    const parts: React.ReactNode[] = [];
    const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let last = 0, m: RegExpExecArray | null, i = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(<span key={i++}>{text.slice(last, m.index)}</span>);
        if (m[0].startsWith('`')) {
            parts.push(<code key={i++} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{m[0].slice(1, -1)}</code>);
        } else {
            parts.push(<strong key={i++}>{m[0].slice(2, -2)}</strong>);
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(<span key={i++}>{text.slice(last)}</span>);
    return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>;
}

// ── Playground ────────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
    { icon: '✨', label: 'Explain something', text: 'Explain how neural networks work in simple terms.' },
    { icon: '🧪', label: 'Write code', text: 'Write a TypeScript function to debounce any async function.' },
    { icon: '📝', label: 'Summarize', text: 'Summarize the key differences between REST and GraphQL APIs.' },
    { icon: '💡', label: 'Brainstorm', text: 'Give me 5 creative ideas for a B2B SaaS startup in the AI space.' },
];

function UserAvatar({ name }: { name?: string }) {
    const initials = name ? name.slice(0, 2).toUpperCase() : 'U';
    return (
        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {initials}
        </div>
    );
}

function AssistantAvatar() {
    return (
        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-sm">
            <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
    );
}

function MessageBubble({ msg, onCopy, onRegenerate, isLast }: {
    msg: ChatMessage;
    onCopy: (id: string, text: string) => void;
    onRegenerate?: () => void;
    isLast?: boolean;
}) {
    const isAssistant = msg.role === 'assistant';

    return (
        <div className={cn('flex flex-col gap-1', isAssistant ? 'items-start' : 'items-end')}>
            <div className={cn('flex items-center gap-2 mb-1 px-1', isAssistant ? 'flex-row' : 'flex-row-reverse')}>
                {isAssistant ? <AssistantAvatar /> : <UserAvatar />}
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{msg.role}</span>
                <span className="text-[10px] text-muted-foreground/60">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className={cn('group relative max-w-[85%] rounded-2xl p-4 text-sm shadow-sm transition-all',
                isAssistant ? 'bg-muted/50 text-foreground rounded-tl-none border border-border/50' : 'bg-primary text-primary-foreground rounded-tr-none shadow-primary/10')}>

                {msg.image && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-white/10 shadow-sm transition-transform hover:scale-[1.02]">
                        <img src={msg.image} alt="User upload" className="max-h-[300px] w-auto object-contain" />
                    </div>
                )}

                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words">
                    {(() => {
                        // Streaming-friendly <think> extraction
                        const thinkStart = msg.content.indexOf('<think>');
                        if (thinkStart !== -1) {
                            const thinkEnd = msg.content.indexOf('</think>');
                            let thought = '';
                            let cleanContent = '';

                            if (thinkEnd !== -1) {
                                // Thinking finished
                                thought = msg.content.slice(thinkStart + 7, thinkEnd).trim();
                                cleanContent = msg.content.slice(thinkEnd + 8).trim();
                            } else {
                                // Model is currently thinking
                                thought = msg.content.slice(thinkStart + 7).trim();
                                cleanContent = '';
                            }

                            return (
                                <>
                                    {thought && <ThoughtProcess thought={thought} />}
                                    {cleanContent ? <MarkdownContent text={cleanContent} /> : (thought ? <p className="text-[10px] text-muted-foreground animate-pulse mt-2 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Model is thinking...</p> : <MarkdownContent text={msg.content} />)}
                                </>
                            );
                        }

                        return <MarkdownContent text={msg.content} />;
                    })()}
                </div>

                {msg.error && (
                    <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                        <Info className="h-3 w-3 shrink-0" /> Request failed
                    </div>
                )}

                {/* Floating Action Bar */}
                <div className={cn(
                    'absolute -bottom-8 flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100',
                    isAssistant ? 'left-0' : 'right-0'
                )}>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => onCopy(msg.id, msg.content)}>
                        <Copy className="h-3 w-3" />
                    </Button>

                    {isAssistant && isLast && onRegenerate && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" onClick={onRegenerate} title="Regenerate Response">
                            <RefreshCw className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </div>

            {msg.usage && isAssistant && (
                <div className="mt-9 px-1 flex items-center gap-3 text-[10px] text-muted-foreground/70 font-mono animate-in fade-in slide-in-from-bottom-1">
                    {(() => {
                        const tokens = msg.usage.totalTokens ?? msg.usage.total_tokens ?? (msg.usage.prompt_tokens ? (msg.usage.prompt_tokens + (msg.usage.completion_tokens || 0)) : 0);
                        const credits = msg.usage.creditsUsed ?? msg.usage.x_fairarena?.credits_used ?? 0;
                        return (
                            <>
                                <span className="flex items-center gap-1"><Layers className="h-2.5 w-2.5" />{tokens.toLocaleString()} tokens</span>
                                <span className="w-1 h-1 rounded-full bg-border" />
                                <span className="flex items-center gap-1"><CircleDollarSign className="h-2.5 w-2.5 font-bold" />{credits.toLocaleString()} credits</span>
                                {msg.latencyMs && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-border" />
                                        <span className="flex items-center gap-1 text-primary/60"><Timer className="h-2.5 w-2.5" />{msg.latencyMs}ms</span>
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

function Playground({ models }: { models: ModelConfig[] }) {
    const [selectedModel, setSelectedModel] = useState('');
    const [modelSearch, setModelSearch] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.');
    const [showSystemPrompt, setShowSystemPrompt] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try {
            const saved = localStorage.getItem('fa_ai_gateway_chat');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [streamEnabled, setStreamEnabled] = useState(true);
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // Persist chat
    useEffect(() => {
        localStorage.setItem('fa_ai_gateway_chat', JSON.stringify(messages));
    }, [messages]);

    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const clearChat = useCallback(() => {
        setMessages([]);
        localStorage.removeItem('fa_ai_gateway_chat');
        toast.success('Chat history cleared');
        setShowClearConfirm(false);
    }, []);

    const toggleVoiceInput = useCallback(() => {
        const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof globalThis.SpeechRecognition; webkitSpeechRecognition?: typeof globalThis.SpeechRecognition }).SpeechRecognition
            ?? (window as unknown as { webkitSpeechRecognition?: typeof globalThis.SpeechRecognition }).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error('Voice input is not supported in this browser');
            return;
        }
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const r = new SpeechRecognition();
        r.continuous = true;
        r.interimResults = true;
        r.lang = 'en-US';
        r.onresult = (e) => {
            const transcript = Array.from(e.results)
                .map(res => res[0].transcript)
                .join('');
            setInput(transcript);
        };
        r.onend = () => setIsListening(false);
        r.onerror = () => { toast.error('Voice recognition error'); setIsListening(false); };
        recognitionRef.current = r;
        r.start();
        setIsListening(true);
    }, [isListening]);

    useEffect(() => {
        if (models.length) {
            const exists = models.some(m => m.id === selectedModel);
            if (!exists || !selectedModel) {
                const preferred = models.find(m => m.category === 'fast') ?? models.find(m => m.category === 'balanced') ?? models[0];
                setSelectedModel(preferred?.id ?? '');
            }
        }
    }, [models, selectedModel]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    const selectedConfig = models.find(m => m.id === selectedModel);
    const isSTT = selectedConfig?.category === 'speech-to-text';
    const isTTS = selectedConfig?.category === 'text-to-speech';
    const isImageGen = selectedConfig?.category === 'image-generation';
    const isEmbedding = selectedConfig?.category === 'embedding';
    const isSpecialModel = isSTT || isTTS || isImageGen || isEmbedding;

    const grouped = Object.entries(CATEGORY_META).map(([cat, meta]) => {
        const items = models.filter(m => {
            const matchesCat = m.category === cat;
            const matchesSearch = !modelSearch ||
                m.display_name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                m.id.toLowerCase().includes(modelSearch.toLowerCase());
            return matchesCat && matchesSearch;
        });
        return { cat, meta, items };
    }).filter(g => g.items.length > 0);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
        if (!file.type.startsWith('image/')) { toast.error('Only image files are supported'); return; }
        const reader = new FileReader();
        reader.onload = () => setPendingImage(reader.result as string);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const copyMessage = (_id: string, text: string) => {
        navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
    };

    const send = useCallback(async (customInput?: string, customImage?: string | null) => {
        const textToSend = customInput ?? input;
        const imageToSend = customImage ?? pendingImage;

        if (!textToSend.trim() && !imageToSend) return;
        if (isLoading) return;
        if (!selectedModel) {
            toast.error('Select a model first');
            return;
        }

        const userMsgId = crypto.randomUUID();
        const assistantMsgId = crypto.randomUUID();

        // 1. Add user message if not a regeneration
        if (!customInput && !customImage) {
            setMessages(prev => [...prev, {
                id: userMsgId,
                role: 'user',
                content: textToSend,
                image: imageToSend ?? undefined,
                timestamp: new Date().toISOString()
            }]);
            setInput('');
            setPendingImage(null);
        }

        // 2. Add empty assistant message
        setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString()
        }]);

        setIsLoading(true);
        abortRef.current = new AbortController();

        try {
            const apiMessages = [
                { role: 'system', content: systemPrompt },
                ...messages.map(m => ({
                    role: m.role,
                    content: m.image ? [
                        { type: 'text', text: m.content },
                        { type: 'image_url', image_url: { url: m.image } }
                    ] : m.content
                })),
                {
                    role: 'user',
                    content: imageToSend ? [
                        { type: 'text', text: textToSend },
                        { type: 'image_url', image_url: { url: imageToSend } }
                    ] : textToSend
                }
            ];

            const response = await fetch(`${API_BASE}/api/v1/ai-gateway/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Ensures session cookies are sent
                body: JSON.stringify({
                    model: selectedModel,
                    messages: apiMessages,
                    stream: streamEnabled,
                    temperature: 0.7
                }),
                signal: abortRef.current?.signal
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Request failed');
            }

            if (streamEnabled) {
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                if (!reader) return;

                let fullContent = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(l => l.trim() !== '');

                    for (const line of lines) {
                        if (line.includes('[DONE]')) break;
                        if (!line.startsWith('data: ')) continue;

                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices[0]?.delta?.content || '';
                            const usage = data.usage || data.x_fairarena;

                            fullContent += content;

                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsgId
                                    ? {
                                        ...m,
                                        content: fullContent,
                                        usage: usage ? { ...m.usage, ...usage } : m.usage,
                                        latencyMs: data.x_fairarena?.latency_ms ?? m.latencyMs
                                    }
                                    : m
                            ));
                        } catch (e) {
                            console.error('Error parsing stream chunk', e);
                        }
                    }
                }
            } else {
                const data = await response.json();
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId
                        ? {
                            ...m,
                            content: data.choices[0].message.content,
                            usage: data.usage || data.x_fairarena,
                            latencyMs: data.x_fairarena?.latency_ms
                        }
                        : m
                ));
            }

        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            toast.error((err as Error).message);
            setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                    ? { ...m, content: 'Error: ' + (err as Error).message, error: true }
                    : m
            ));
        } finally {
            setIsLoading(false);
            abortRef.current = null;
        }
    }, [input, pendingImage, isLoading, selectedModel, messages, systemPrompt, streamEnabled]);

    const regenerate = useCallback(async () => {
        if (isLoading || messages.length === 0) return;

        const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user');
        if (!lastUserMessage) {
            toast.error('No previous user message to regenerate from.');
            return;
        }

        // Remove the last assistant message
        setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
                newMessages.pop();
            }
            return newMessages;
        });

        // Re-send the last user message
        await send(lastUserMessage.content, lastUserMessage.image);
    }, [isLoading, messages, send]);

    const tokenEstimate = Math.ceil((input.length + (systemPrompt.length || 0)) / 4);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 items-start">
            {/* ── Config sidebar ── */}
            <div className="space-y-3">
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Bot className="h-4 w-4 text-primary" /> Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-4 pb-4">
                        {/* Model selector */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model</label>
                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-red-500 transition-colors" onClick={() => setShowClearConfirm(true)} title="Clear chat history">
                                    <History className="h-3 w-3" />
                                </Button>
                            </div>
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select model..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-96">
                                    <div className="px-2 pb-2 pt-1">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search models..."
                                                value={modelSearch}
                                                onChange={e => setModelSearch(e.target.value)}
                                                onKeyDown={e => e.stopPropagation()}
                                                className="w-full h-8 pl-8 pr-3 py-2 text-xs bg-muted/50 rounded-md border-none focus:ring-1 focus:ring-primary focus:outline-none"
                                            />
                                            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        </div>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {grouped.map(({ cat, meta, items }) => (
                                            <div key={cat}>
                                                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-widest border-t first:border-0 mt-1">
                                                    <span>{meta.icon}</span> {meta.label}
                                                </div>
                                                {items.map(m => (
                                                    <SelectItem key={m.id} value={m.id} className="text-sm pl-6 py-1.5">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <span className="truncate">{m.display_name}</span>
                                                            <div className="flex gap-1 shrink-0">
                                                                {m.supports_vision && <Eye className="h-3 w-3 text-blue-400" />}
                                                                {m.supports_tool_calling && <Wrench className="h-3 w-3 text-orange-400" />}
                                                                {m.supports_streaming && <Zap className="h-3 w-3 text-yellow-400" />}
                                                            </div>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        ))}
                                        {grouped.length === 0 && (
                                            <div className="py-6 text-center text-xs text-muted-foreground">No models found</div>
                                        )}
                                    </div>
                                </SelectContent>
                            </Select>

                            {selectedConfig && (
                                <div className="mt-2 p-2.5 rounded-lg bg-muted/50 space-y-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <CategoryBadge category={selectedConfig.category} />
                                        {selectedConfig.supports_streaming && <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5"><Zap className="h-2 w-2" />Stream</Badge>}
                                        {selectedConfig.supports_vision && <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5 text-blue-500 border-blue-500/30"><Eye className="h-2 w-2" />Vision</Badge>}
                                        {selectedConfig.supports_tool_calling && <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5"><Wrench className="h-2 w-2" />Tools</Badge>}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>{(selectedConfig.context_window / 1000).toFixed(0)}k context</span>
                                        <span className="font-mono">{selectedConfig.pricing.input_credits_per_1k_tokens}↑ / {selectedConfig.pricing.output_credits_per_1k_tokens}↓ cr/1k</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Streaming toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-xs font-medium">Streaming</span>
                                {!selectedConfig?.supports_streaming && <p className="text-[10px] text-muted-foreground">Not supported by this model</p>}
                            </div>
                            <button onClick={() => setStreamEnabled(v => !v)}
                                disabled={!selectedConfig?.supports_streaming}
                                className={cn('relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
                                    streamEnabled && selectedConfig?.supports_streaming ? 'bg-primary' : 'bg-muted',
                                    !selectedConfig?.supports_streaming && 'opacity-40 cursor-not-allowed')}>
                                <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform',
                                    streamEnabled && selectedConfig?.supports_streaming ? 'translate-x-4' : 'translate-x-0')} />
                            </button>
                        </div>

                        {/* System prompt collapsible */}
                        <div className="space-y-1.5">
                            <button onClick={() => setShowSystemPrompt(v => !v)}
                                className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                                <span className="flex items-center gap-1.5 uppercase tracking-wide">
                                    <Info className="h-3 w-3" /> System Prompt
                                </span>
                                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showSystemPrompt && 'rotate-90')} />
                            </button>
                            {showSystemPrompt && (
                                <div className="space-y-1">
                                    <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                                        placeholder="System instructions..." className="text-xs min-h-[60px] resize-none font-mono" rows={3} />
                                    <p className="text-[10px] text-muted-foreground">Tokens billed per request.</p>
                                </div>
                            )}
                        </div>

                        {/* Clear button */}
                        {messages.length > 0 && (
                            <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setMessages([])}>
                                Clear Conversation
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Vision hint */}
                {selectedConfig?.supports_vision && (
                    <div className="flex items-start gap-2 rounded-xl p-3 bg-blue-500/5 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
                        <Eye className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>Vision enabled — upload images using the 📎 button in the input bar.</span>
                    </div>
                )}
            </div>

            {/* ── Chat window ── */}
            <div className={cn("flex flex-col gap-0 rounded-xl border bg-card shadow-sm overflow-hidden")} style={{ minHeight: isSpecialModel ? 400 : 600 }}>
                {/* Chat header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">Chat Playground</span>
                        {selectedConfig && (
                            <Badge variant="secondary" className="text-[10px] font-mono">{selectedConfig.display_name}</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isLoading && (
                            <Badge variant="secondary" className="text-[10px] animate-pulse gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping inline-block" />
                                Responding
                            </Badge>
                        )}
                        {messages.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
                        )}
                    </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5" style={{ minHeight: 420, maxHeight: 540 }}>
                    {messages.length === 0 && !isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6 py-10">
                            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                                <Bot className="h-10 w-10 text-primary" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-foreground">Ready to chat</p>
                                <p className="text-sm text-muted-foreground mt-1">Pick a suggestion or type your own message</p>
                            </div>
                            {/* Quick prompts */}
                            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                                {QUICK_PROMPTS.map(p => (
                                    <button key={p.label} onClick={() => { setInput(p.text); textareaRef.current?.focus(); }}
                                        className="text-left p-3 rounded-xl border bg-muted/30 hover:bg-muted/60 hover:border-primary/40 transition-all group">
                                        <span className="text-base">{p.icon}</span>
                                        <p className="text-xs font-medium mt-1 text-foreground group-hover:text-primary transition-colors">{p.label}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <MessageBubble
                                key={msg.id}
                                msg={msg}
                                onCopy={copyMessage}
                                isLast={index === messages.length - 1}
                                onRegenerate={index === messages.length - 1 ? regenerate : undefined}
                            />
                        ))
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Image preview strip */}
                {pendingImage && (
                    <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-2">
                        <div className="relative">
                            <img src={pendingImage} alt="Pending" className="w-12 h-12 rounded-lg object-cover border" />
                            <button onClick={() => setPendingImage(null)}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background border flex items-center justify-center shadow-sm hover:text-red-500 transition-colors">
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </div>
                        <span className="text-xs text-muted-foreground">Image ready to send</span>
                    </div>
                )}

                {/* Input bar — adapts to model category */}
                <div className="border-t bg-card px-4 py-3">
                    <div>
                        <div className="flex items-end gap-2">
                            {/* Vision upload */}
                            {selectedConfig?.supports_vision && (
                                <>
                                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    <button onClick={() => fileRef.current?.click()} disabled={isLoading}
                                        className={cn('shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border transition-colors',
                                            pendingImage ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'hover:bg-muted border-border text-muted-foreground hover:text-foreground')}>
                                        <ImageIcon className="h-4 w-4" />
                                    </button>
                                </>
                            )}

                            {/* Voice input button (for non-STT models) */}
                            <button
                                onClick={toggleVoiceInput}
                                disabled={isLoading}
                                title={isListening ? 'Stop listening' : 'Voice input'}
                                className={cn(
                                    'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border transition-colors',
                                    isListening
                                        ? 'bg-pink-500/10 border-pink-500/30 text-pink-500 animate-pulse'
                                        : 'hover:bg-muted border-border text-muted-foreground hover:text-foreground'
                                )}>
                                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </button>

                            <div className="flex-1 relative">
                                <textarea
                                    ref={textareaRef}
                                    id="playground-input"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            void send();
                                        }
                                    }}
                                    placeholder={selectedModel ? 'Message… (Enter to send, Shift+Enter for new line)' : 'Select a model first…'}
                                    disabled={isLoading || !selectedModel}
                                    rows={1}
                                    style={{ minHeight: 44, maxHeight: 160, resize: 'none', overflowY: 'auto' }}
                                    className={cn(
                                        'w-full rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm',
                                        'placeholder:text-muted-foreground/60',
                                        'focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50',
                                        'disabled:opacity-50 transition-colors',
                                    )}
                                />
                            </div>

                            {/* Stop / Send */}
                            {isLoading ? (
                                <button onClick={() => { abortRef.current?.abort(); setIsLoading(false); }}
                                    className="shrink-0 w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            ) : (
                                <button id="playground-send-btn" onClick={() => void send()}
                                    disabled={(!input.trim() && !pendingImage) || !selectedModel}
                                    className={cn(
                                        'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                                        (!input.trim() && !pendingImage) || !selectedModel
                                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                            : 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm hover:shadow-primary/25',
                                    )}>
                                    <Send className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Bottom hint row */}
                        <div className="flex items-center justify-between mt-1.5 px-0.5">
                            <span className="text-[10px] text-muted-foreground">
                                {input.length > 0 ? `${input.length} chars · ~${tokenEstimate} tokens est.` : 'Enter to send · Shift+Enter for new line'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                {messages.filter(m => m.role !== 'system').length} messages in context
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Confirm Clear Dialog ── */}
            <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Clear Chat History
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to clear your entire chat history? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={clearChat} className="bg-destructive hover:bg-destructive/90">
                            Clear History
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ── Models Explorer ────────────────────────────────────────────────────────────

function ModelsExplorer({ models, isLoading }: { models: ModelConfig[]; isLoading: boolean }) {
    const [search, setSearch] = useState('');

    const filtered = models.filter(m => {
        if (search && !m.display_name.toLowerCase().includes(search.toLowerCase()) && !m.id.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    if (isLoading) return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
                <Card key={i} className="border"><CardContent className="p-4 space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></CardContent></Card>
            ))}
        </div>
    );

    // Grouping for high-density 3-column layout
    const groupMap = {
        col1: [
            { id: 'reasoning', label: 'Reasoning & Logic', icon: <Layers className="h-4 w-4" /> },
            { id: 'powerful', label: 'Powerful Tiers', icon: <Flame className="h-4 w-4" /> },
            { id: 'coding', label: 'Full Coding', icon: <Code2 className="h-4 w-4" /> },
        ],
        col2: [
            { id: 'balanced', label: 'Balanced Performance', icon: <Globe className="h-4 w-4" /> },
            { id: 'fast', label: 'Instant / Fast', icon: <Zap className="h-4 w-4" /> },
            { id: 'safety', label: 'Safety & Moderation', icon: <ShieldCheck className="h-4 w-4" /> },
        ],
        col3: [
            { id: 'vision', label: 'Vision & Multimodal', icon: <Eye className="h-4 w-4" /> },
            { id: 'embedding', label: 'Embeddings', icon: <Tag className="h-4 w-4" /> },
        ]
    };

    const renderColumn = (col: typeof groupMap.col1) => (
        <div className="space-y-6">
            {col.map(cat => {
                const catModels = filtered.filter(m => m.category === cat.id);
                if (catModels.length === 0 && !search) return null;
                if (catModels.length === 0) return null;

                return (
                    <div key={cat.id} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                {cat.icon}
                            </div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{cat.label}</h3>
                            <Badge variant="secondary" className="ml-auto text-[10px] py-0 h-4">{catModels.length}</Badge>
                        </div>
                        <div className="grid gap-2">
                            {catModels.map(model => (
                                <Card key={model.id} className="group border bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-200">
                                    <CardContent className="p-3">
                                        <div className="flex items-start justify-between gap-2 overflow-hidden">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-xs truncate group-hover:text-primary transition-colors">{model.display_name}</p>
                                                    {model.supports_vision && <Eye className="h-3 w-3 text-blue-500 shrink-0" />}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground font-mono truncate">{model.id.split('/')[1]}</p>
                                            </div>
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0 uppercase tracking-tighter opacity-70">
                                                {model.id.split('/')[0]}
                                            </Badge>
                                        </div>
                                        <div className="mt-2.5 flex items-center justify-between text-[10px]">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {(model.context_window / 1000).toFixed(0)}k</span>
                                                <span className="flex items-center gap-0.5"><CircleDollarSign className="h-2.5 w-2.5" /> {model.pricing.input_credits_per_1k_tokens}↑</span>
                                            </div>
                                            <div className="flex gap-1">
                                                {model.supports_tool_calling && <Wrench className="h-2.5 w-2.5 text-muted-foreground" title="Tools Supported" />}
                                                {model.supports_streaming && <Zap className="h-2.5 w-2.5 text-yellow-500" title="Streaming Supported" />}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="relative group max-w-md">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Search model registry..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-10 w-full pl-10 pr-4 rounded-xl border bg-card/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {renderColumn(groupMap.col1)}
                {renderColumn(groupMap.col2)}
                {renderColumn(groupMap.col3)}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed">
                    <Bot className="h-10 w-10 mx-auto mb-4 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground font-medium">No models found matching "{search}"</p>
                    <Button variant="link" size="sm" onClick={() => setSearch('')} className="mt-2">Clear search</Button>
                </div>
            )}
        </div>
    );
}

// ── Usage Stats ────────────────────────────────────────────────────────────────

function UsageStatsPanel() {
    const [days, setDays] = useState(30);
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['ai-gateway-usage', days],
        queryFn: () => apiRequest<UsageStats>(`${API_BASE}/api/v1/ai-gateway/usage?days=${days}`).then(r => r.data),
        staleTime: 30_000,
    });
    const summary = data?.summary;
    const modelBreakdown = data?.modelBreakdown ?? [];
    const recentRequests = data?.recentRequests ?? [];

    // Calculate provider distribution
    const providerStats = modelBreakdown.reduce((acc, curr) => {
        acc[curr.provider] = (acc[curr.provider] || 0) + curr.requests;
        return acc;
    }, {} as Record<string, number>);
    const sortedProviders = Object.entries(providerStats).sort((a, b) => b[1] - a[1]);

    const PROVIDER_COLORS: Record<string, string> = {
        groq: 'text-orange-500',
        gemini: 'text-blue-500 font-bold',
        openrouter: 'text-purple-500',
        cloudflare: 'text-amber-500',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold">Usage Statistics</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Gateway activity and credit consumption</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
                        <SelectTrigger className="h-8 w-32 text-xs bg-muted/30 border-none"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => void refetch()}><RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} /></Button>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="border"><CardContent className="p-4"><Skeleton className="h-3 w-20 mb-2" /><Skeleton className="h-7 w-16" /></CardContent></Card>)}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Requests', value: summary?.totalRequests.toLocaleString() ?? '0', icon: <Activity className="h-4 w-4" />, color: 'text-blue-500' },
                        { label: 'Credits Consumed', value: summary?.totalCreditsUsed.toLocaleString() ?? '0', icon: <CircleDollarSign className="h-4 w-4" />, color: 'text-green-500' },
                        { label: 'Total Tokens', value: summary?.totalTokens ? `${(summary.totalTokens / 1000).toFixed(1)}k` : '0', icon: <Layers className="h-4 w-4" />, color: 'text-purple-500' },
                        { label: 'Avg Latency', value: summary?.averageLatencyMs ? `${summary.averageLatencyMs}ms` : '—', icon: <Gauge className="h-4 w-4" />, color: 'text-orange-500' },
                    ].map(({ label, value, icon, color }) => (
                        <Card key={label} className="border hover:border-primary/20 transition-colors shadow-sm"><CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">{cloneElement(icon as React.ReactElement, { className: cn("h-3.5 w-3.5", color) })}<span className="text-[10px] uppercase font-bold tracking-wider">{label}</span></div>
                            <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
                        </CardContent></Card>
                    ))}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                {/* ── Requests by Provider (Donut) ── */}
                <Card className="border flex flex-col">
                    <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-muted-foreground">Provider Distribution</CardTitle></CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center gap-4 py-4 px-6">
                        {sortedProviders.length > 0 ? (
                            <>
                                <div className="relative h-24 w-24 mx-auto">
                                    <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90">
                                        {(() => {
                                            let offset = 0;
                                            const total = Object.values(providerStats).reduce((a, b) => a + b, 0);
                                            return sortedProviders.map(([provider, count]) => {
                                                const percent = (count / total) * 100;
                                                const stroke = 32 * Math.PI * (percent / 100);
                                                const currentOffset = offset;
                                                offset += percent;
                                                const color = provider === 'groq' ? '#f97316' : provider === 'gemini' ? '#3b82f6' : provider === 'openrouter' ? '#a855f7' : '#f59e0b';
                                                return (
                                                    <circle key={provider} cx="16" cy="16" r="14" fill="none" stroke={color} strokeWidth="4"
                                                        strokeDasharray={`${stroke} 100`} strokeDashoffset={-(currentOffset / 100) * 100} className="transition-all duration-1000" />
                                                );
                                            });
                                        })()}
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-xs font-bold">{Object.keys(providerStats).length}</span>
                                        <span className="text-[8px] text-muted-foreground uppercase">Sources</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {sortedProviders.map(([provider, count]) => {
                                        const total = Object.values(providerStats).reduce((a, b) => a + b, 0);
                                        const percent = Math.round((count / total) * 100);
                                        return (
                                            <div key={provider} className="flex items-center gap-2 text-[10px]">
                                                <span className={cn("w-2 h-2 rounded-full", provider === 'groq' ? 'bg-orange-500' : provider === 'gemini' ? 'bg-blue-500' : provider === 'openrouter' ? 'bg-purple-500' : 'bg-amber-500')} />
                                                <span className="capitalize flex-1 font-medium">{provider}</span>
                                                <span className="text-muted-foreground font-mono">{percent}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground text-[10px] italic">No data available</div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Status Rate ── */}
                <Card className="border flex flex-col">
                    <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-muted-foreground">Request Health</CardTitle></CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center gap-6 py-4 px-6">
                        {recentRequests.length > 0 ? (() => {
                            const successRate = Math.round((recentRequests.filter(r => r.status === 'SUCCESS').length / recentRequests.length) * 100);
                            return (
                                <>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="text-3xl font-black font-mono tracking-tighter" style={{ color: successRate > 95 ? '#22c55e' : successRate > 80 ? '#f59e0b' : '#ef4444' }}>{successRate}%</div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Success Rate</div>
                                    </div>
                                    <div className="space-y-2">
                                        {['SUCCESS', 'ERROR', 'RATE_LIMITED'].map(s => {
                                            const count = recentRequests.filter(r => r.status === (s === 'SUCCESS' ? 'SUCCESS' : s === 'ERROR' ? 'ERROR' : 'RATE_LIMITED')).length;
                                            if (count === 0 && s !== 'SUCCESS') return null;
                                            const pct = Math.round((count / recentRequests.length) * 100);
                                            return (
                                                <div key={s} className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-mono"><span className="text-muted-foreground">{s.replace('_', ' ')}</span><span>{count}</span></div>
                                                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                                        <div className={cn("h-full rounded-full transition-all", s === 'SUCCESS' ? 'bg-green-500' : s === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500')} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })() : <div className="text-center py-8 text-muted-foreground text-[10px] italic">No data available</div>}
                    </CardContent>
                </Card>

                {/* ── Latency ── */}
                <Card className="border flex flex-col">
                    <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-muted-foreground">Latency Profile</CardTitle></CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center gap-4 py-4 px-6">
                        {recentRequests.length > 0 ? (() => {
                            const validLats = recentRequests.filter(r => !r.cached && r.latencyMs > 0).map(r => r.latencyMs).sort((a, b) => a - b);
                            if (validLats.length === 0) return <div className="text-center py-8 text-muted-foreground text-[10px] italic">No latency data</div>;
                            const p50 = validLats[Math.floor(validLats.length * 0.5)];
                            const p90 = validLats[Math.floor(validLats.length * 0.9)];
                            return (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center border-r">
                                            <div className="text-lg font-bold font-mono tracking-tight">{p50}ms</div>
                                            <div className="text-[9px] uppercase font-bold text-muted-foreground">Median</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold font-mono tracking-tight">{p90}ms+</div>
                                            <div className="text-[9px] uppercase font-bold text-muted-foreground">P90 Slow</div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2">
                                        {[
                                            { label: '<500ms', range: [0, 500], color: 'bg-green-500' },
                                            { label: '500-2s', range: [500, 2000], color: 'bg-amber-500' },
                                            { label: '>2s', range: [2000, 99999], color: 'bg-red-500' },
                                        ].map(b => {
                                            const count = validLats.filter(l => l >= b.range[0] && l < b.range[1]).length;
                                            const pct = Math.round((count / validLats.length) * 100);
                                            return (
                                                <div key={b.label} className="flex items-center gap-3">
                                                    <span className="text-[9px] font-mono text-muted-foreground w-12">{b.label}</span>
                                                    <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                                        <div className={cn("h-full transition-all", b.color)} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="text-[9px] font-bold w-6 text-right">{pct}%</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })() : <div className="text-center py-8 text-muted-foreground text-[10px] italic">No data available</div>}
                    </CardContent>
                </Card>
            </div>

            {/* ── By Model Table ── */}
            {data && modelBreakdown.length > 0 && (
                <Card className="border overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Model Analytics</CardTitle>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold font-mono">Top {modelBreakdown.length} Active</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b bg-muted/10 text-[10px] uppercase font-bold text-muted-foreground">
                                        <th className="px-5 py-2.5 text-left">Model / Provider</th>
                                        <th className="px-5 py-2.5 text-right w-24">Requests</th>
                                        <th className="px-5 py-2.5 text-right w-32">Tokens</th>
                                        <th className="px-5 py-2.5 text-right w-24">Credits</th>
                                        <th className="px-5 py-2.5 text-right w-32">Consumption</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {modelBreakdown.slice(0, 10).map(row => {
                                        const maxCredits = Math.max(...modelBreakdown.map(m => m.creditsUsed), 1);
                                        const creditPct = (row.creditsUsed / maxCredits) * 100;
                                        return (
                                            <tr key={row.model} className="hover:bg-primary/[0.02] group transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("w-1 h-8 rounded-full shrink-0", row.provider === 'groq' ? 'bg-orange-500' : row.provider === 'gemini' ? 'bg-blue-500' : 'bg-purple-500')} />
                                                        <div>
                                                            <div className="font-bold flex items-center gap-1.5">{row.model.split('/').pop()} <span className="text-[10px] text-muted-foreground/50 font-mono font-normal">({row.model})</span></div>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border",
                                                                    PROVIDER_COLORS[row.provider]?.includes('orange') ? 'bg-orange-500/10 border-orange-500/20 text-orange-600' :
                                                                        PROVIDER_COLORS[row.provider]?.includes('blue') ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' :
                                                                            'bg-purple-500/10 border-purple-500/20 text-purple-600'
                                                                )}>
                                                                    {row.provider}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-right font-mono font-medium">{row.requests.toLocaleString()}</td>
                                                <td className="px-5 py-3 text-right font-mono text-muted-foreground">{(row.tokens / 1000).toFixed(1)}k</td>
                                                <td className="px-5 py-3 text-right font-mono font-bold">{row.creditsUsed.toLocaleString()}</td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary/60" style={{ width: `${creditPct}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Recent Requests Table ── */}
            {data && recentRequests.length > 0 && (
                <Card className="border shadow-sm"><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-xs uppercase font-bold text-muted-foreground">Request Log</CardTitle> <span className="text-[10px] text-muted-foreground">Showing last {recentRequests.length}</span></CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead><tr className="border-b bg-muted/10 text-muted-foreground font-bold">
                                {['Time', 'Model', 'Status', 'Tokens', 'Credits', 'Latency'].map(h => (
                                    <th key={h} className="px-4 py-2.5 text-left uppercase tracking-tighter">{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y">
                                {recentRequests.slice(0, 15).map(req => (
                                    <tr key={req.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(req.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                        <td className="px-4 py-2.5 font-mono max-w-[140px] truncate font-medium">{req.model.split('/').pop()}</td>
                                        <td className="px-4 py-2.5"><span className={cn('px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase', req.status === 'SUCCESS' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600')}>{req.status}</span></td>
                                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{(req.promptTokens + req.completionTokens).toLocaleString()}</td>
                                        <td className="px-4 py-2.5 font-mono font-bold">{req.creditsUsed}</td>
                                        <td className="px-4 py-2.5 font-mono whitespace-nowrap">{req.cached ? <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 text-[8px] h-3 px-1 border-none">CACHED</Badge> : `${req.latencyMs}ms`}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {!isLoading && (!data || (summary?.totalRequests ?? 0) === 0) && (
                <div className="text-center py-20 border-2 border-dashed border-muted rounded-2xl bg-muted/5">
                    <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4"><Activity className="h-6 w-6 text-muted-foreground/40" /></div>
                    <p className="font-bold text-lg">No traffic recorded yet</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">Interact with models in the Playground or use your API key to see usage stats here.</p>
                    <Button variant="outline" size="sm" className="mt-6" onClick={() => void refetch()}>Check again</Button>
                </div>
            )}
        </div>
    );
}


// ── API Reference ─────────────────────────────────────────────────────────────

function ApiReference({ apiKeys, defaultModel }: { apiKeys: Array<{ id: string; name: string; prefix: string }>; defaultModel?: string }) {
    const [showKey, setShowKey] = useState(false);
    const hasKey = apiKeys.length > 0;
    const keyPlaceholder = hasKey ? `${apiKeys[0].prefix}...` : 'fa_live_YOUR_KEY';
    const navigate = useNavigate();
    const model = defaultModel || 'groq/llama-3.3-70b';

    const curlExample = `curl ${API_BASE}/v1/chat/completions \\
  -H "Authorization: Bearer ${keyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

    const jsExample = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${keyPlaceholder}",
  baseURL: "${API_BASE}/v1",
});

const chat = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(chat.choices[0].message.content);`;

    const metadataExample = `{
  "id": "chatcmpl-...",
  "choices": [...],
  "usage": { "total_tokens": 42, ... },
  "x_fairarena": {
    "credits_used": 1,
    "cached": false,
    "latency_ms": 450,
    "model_info": { "provider": "groq", "category": "balanced" }
  }
}`;

    const toolExample = `// Tool calling is automatically emulated for all models
const chat = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "What's the weather in London?" }],
  tools: [{
    type: "function",
    function: {
      name: "get_weather",
      parameters: { ... }
    }
  }]
});`;

    return (
        <div className="space-y-10 max-w-4xl pb-10">
            {/* ── Auth & Base URL ── */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-2"><Key className="h-4 w-4 text-primary" /><h2 className="font-semibold">Authentication</h2></div>
                    <p className="text-sm text-muted-foreground">Use your FairArena API key as a Bearer token. Generate keys in your account settings.</p>
                    {!hasKey ? (
                        <Button size="sm" variant="outline" className="w-full h-10 border-dashed" onClick={() => navigate('/dashboard/account-settings')}>
                            Create API Key <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                            <Key className="h-4 w-4 text-primary shrink-0" />
                            <code className="text-xs font-mono flex-1">{showKey ? apiKeys[0].prefix + '...' : '••••••••••••••••'}</code>
                            <button onClick={() => setShowKey(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /><h2 className="font-semibold">Base URL</h2></div>
                    <p className="text-sm text-muted-foreground">Drop-in compatible with the OpenAI SDK. Simply override the <code className="bg-muted px-1 rounded">baseURL</code>.</p>
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30 font-mono text-xs">
                        <span className="flex-1 text-muted-foreground">{API_BASE}/v1</span>
                        <CopyButton text={`${API_BASE}/v1`} />
                    </div>
                </div>
            </div>

            {/* ── Quick Start ── */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 border-b pb-2"><Code2 className="h-4 w-4 text-primary" /><h2 className="font-semibold">Quick Start</h2></div>
                <Tabs defaultValue="curl" className="w-full">
                    <TabsList className="bg-muted/50 mb-4">
                        <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
                        <TabsTrigger value="node" className="text-xs">Node.js</TabsTrigger>
                        <TabsTrigger value="tools" className="text-xs">Tools</TabsTrigger>
                        <TabsTrigger value="meta" className="text-xs">Metadata</TabsTrigger>
                    </TabsList>
                    <TabsContent value="curl" className="mt-0">
                        <CodeBlock code={curlExample} lang="bash" />
                    </TabsContent>
                    <TabsContent value="node" className="mt-0">
                        <CodeBlock code={jsExample} lang="javascript" />
                    </TabsContent>
                    <TabsContent value="tools" className="mt-0">
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">FairArena provides <strong>automatic fallback emulation</strong> for tool-calling on models that don't natively support it.</p>
                            <CodeBlock code={toolExample} lang="javascript" />
                        </div>
                    </TabsContent>
                    <TabsContent value="meta" className="mt-0">
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">Every response includes a <code className="bg-muted px-1 rounded">x_fairarena</code> object with billing and latentcy data.</p>
                            <CodeBlock code={metadataExample} lang="json" />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* ── Billing & Protection ── */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 border-b pb-2"><CircleDollarSign className="h-4 w-4 text-primary" /><h2 className="font-semibold">Credit Management</h2></div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Card className="border bg-primary/[0.02] border-primary/10">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Zero-Fee Errors</div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">Credits are <strong>only charged</strong> for successful responses. If a provider (Groq, Gemini, etc.) fails, your balance stays the same.</p>
                        </CardContent>
                    </Card>
                    <Card className="border bg-blue-500/[0.02] border-blue-500/10">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-500"><Zap className="h-3.5 w-3.5" /> Free Caching</div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">Identical requests are cached (via semantic hash) for 5 minutes. <strong>Cached responses cost 0 credits.</strong></p>
                        </CardContent>
                    </Card>
                    <Card className="border bg-orange-500/[0.02] border-orange-500/10">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-500"><AlertTriangle className="h-3.5 w-3.5" /> Low Limit Alert</div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">Recieve an email when your balance dips below <strong>500 credits</strong>. This shield ensures you never run out unexpectedly.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ── Endpoints ── */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 border-b pb-2"><Terminal className="h-4 w-4 text-primary" /><h2 className="font-semibold">Endpoint Reference</h2></div>
                <div className="rounded-xl border overflow-hidden bg-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b bg-muted/30">
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Method</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Endpoint</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Description</th>
                        </tr></thead>
                        <tbody className="divide-y">
                            {[
                                { method: 'POST', path: '/v1/chat/completions', desc: 'Standard completions, streaming, vision, and tool-calling.' },
                                { method: 'GET', path: '/v1/models', desc: 'List all active models with their pricing and features.' },
                                { method: 'GET', path: '/v1/models/:id', desc: 'Retrieve detailed config for a specific model ID.' },
                            ].map(({ method, path, desc }) => (
                                <tr key={path} className="hover:bg-muted/10 transition-colors group">
                                    <td className="px-4 py-3.5"><Badge variant="outline" className={cn('text-[10px] font-mono font-bold border-none', method === 'POST' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600')}>{method}</Badge></td>
                                    <td className="px-4 py-3.5 font-mono text-xs text-foreground/80 group-hover:text-primary transition-colors">{path}</td>
                                    <td className="px-4 py-3.5 text-xs text-muted-foreground leading-relaxed">{desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <Card className="border shadow-sm group hover:border-primary/20 transition-all"><CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold"><Flame className="h-4 w-4 text-orange-500" />Concurrency & Rate Limits</div>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />60 requests / minute per user (Sliding Window)</li>
                        <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />4,096 tokens max output (per model default)</li>
                        <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />Contact support for Enterprise throughput upgrades</li>
                    </ul>
                </CardContent></Card>
                <Card className="border shadow-sm group hover:border-primary/20 transition-all"><CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold"><TrendingDown className="h-4 w-4 text-primary" />Advanced Configuration</div>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />Set <code className="bg-muted px-1 rounded">"cache": false</code> to force live inference</li>
                        <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />Set <code className="bg-muted px-1 rounded">"cache_ttl": 3600</code> for extended caching</li>
                        <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />Enable <code className="bg-muted px-1 rounded">"stream": true</code> for lowest perceived latency</li>
                    </ul>
                </CardContent></Card>
            </div>
        </div>
    );
}

// ── Status Monitor ────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
    operational: 'bg-green-500',
    degraded: 'bg-amber-400',
    outage: 'bg-red-500',
    unknown: 'bg-muted-foreground/40',
};
const STATUS_LABEL: Record<string, string> = {
    operational: 'Operational',
    degraded: 'Degraded',
    outage: 'Outage',
    unknown: 'Unknown',
};
const STATUS_BADGE_CLS: Record<string, string> = {
    operational: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    degraded: 'bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/20',
    outage: 'bg-red-500/10 text-red-500 border-red-500/20',
    unknown: 'bg-muted/50 text-muted-foreground border-border',
};
const PROVIDER_LABELS: Record<string, { label: string; icon: string }> = {
    groq: { label: 'Groq Inference', icon: '⚡' },
    gemini: { label: 'Google Gemini', icon: '✦' },
    openrouter: { label: 'OpenRouter', icon: '◎' },
    cloudflare: { label: 'Cloudflare AI', icon: '☁️' },
};

function UptimeBar({ percent }: { percent: number }) {
    const col = percent >= 98 ? 'bg-green-500' : percent >= 90 ? 'bg-amber-400' : 'bg-red-500';
    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>24h uptime</span>
                <span className={cn('font-mono font-medium', percent >= 98 ? 'text-green-500' : percent >= 90 ? 'text-amber-500' : 'text-red-500')}>{percent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', col)} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}

function LatencyBadge({ ms }: { ms: number | null }) {
    if (ms === null) return <span className="text-xs text-muted-foreground font-mono">—</span>;
    const col = ms < 1000 ? 'text-green-500' : ms < 3000 ? 'text-amber-500' : 'text-red-500';
    return <span className={cn('text-xs font-mono font-medium', col)}>{ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}</span>;
}

function StatusMonitor() {
    const [probing, setProbing] = useState(false);
    const [filterProvider, setFilterProvider] = useState('all');

    const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
        queryKey: ['model-status'],
        queryFn: async () => {
            // Backend returns { success: true, data: { models, probeRanAt, incidentHistory } }
            const res = await apiRequest<StatusResponse>(`${API_BASE}/api/v1/ai-gateway/models/status`);
            return res.data; // unwrap the data field
        },
        refetchInterval: 60_000,
        staleTime: 30_000,
    });

    const triggerProbe = async () => {
        setProbing(true);
        try {
            await apiFetch(`${API_BASE}/api/v1/ai-gateway/models/probe`, {
                method: 'POST',
            });
            toast.success('Probe started! Results will update in ~15 seconds.');
            setTimeout(() => { void refetch(); setProbing(false); }, 16_000);
        } catch { toast.error('Failed to trigger probe'); setProbing(false); }
    };

    const models = data?.models ?? [];
    const probeRanAt = data?.probeRanAt;
    const providers = ['groq', 'gemini', 'openrouter', 'cloudflare'];
    const filteredModels = filterProvider === 'all' ? models : models.filter(m => m.provider === filterProvider);

    const hasCritical = models.some(m => m.status === 'outage');
    const hasDegraded = models.some(m => m.status === 'degraded');
    const overallStatus = hasCritical ? 'outage' : hasDegraded ? 'degraded' : models.length === 0 ? 'unknown' : 'operational';
    const overallLabel = hasCritical ? 'Partial Outage Detected' : hasDegraded ? 'Degraded Performance' : models.length === 0 ? 'Checking…' : 'All Systems Operational';

    const providerSummary = providers.map(p => {
        const pm = models.filter(m => m.provider === p);
        const s = pm.some(m => m.status === 'outage') ? 'outage' : pm.some(m => m.status === 'degraded') ? 'degraded' : pm.length === 0 ? 'unknown' : 'operational';
        const avgLat = pm.filter(m => m.latencyMs !== null).reduce((a, m, _, arr) => a + (m.latencyMs ?? 0) / arr.length, 0);
        const avgUp = pm.length ? Math.round(pm.reduce((a, m) => a + m.uptimePercent, 0) / pm.length) : 100;
        return { provider: p, status: s, latencyMs: avgLat || null, avgUptime: avgUp };
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-base font-semibold flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" /> Model Health Status
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Real-time availability and latency across all providers
                        {probeRanAt && <> · Last checked {new Date(probeRanAt).toLocaleTimeString()}</>}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => void refetch()} title="Refresh">
                        <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void triggerProbe()} disabled={probing}>
                        {probing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Probing…</> : 'Run Health Check'}
                    </Button>
                </div>
            </div>

            {/* Overall banner */}
            <div className={cn('rounded-xl border p-4 flex items-center gap-4',
                overallStatus === 'operational' ? 'bg-green-500/5 border-green-500/20' :
                    overallStatus === 'degraded' ? 'bg-amber-400/5 border-amber-400/20' :
                        overallStatus === 'outage' ? 'bg-red-500/5 border-red-500/20' : 'bg-muted/30 border-border',
            )}>
                <div className={cn('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                    overallStatus === 'operational' ? 'bg-green-500/10' : overallStatus === 'degraded' ? 'bg-amber-400/10' : 'bg-red-500/10'
                )}>
                    <ShieldCheck className={cn('h-5 w-5',
                        overallStatus === 'operational' ? 'text-green-500' : overallStatus === 'degraded' ? 'text-amber-400' : 'text-red-500'
                    )} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold">{overallLabel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {models.filter(m => m.status === 'operational').length}/{models.length} models operational
                        {dataUpdatedAt > 0 && <> · Updated {new Date(dataUpdatedAt).toLocaleTimeString()}</>}
                    </p>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium shrink-0', STATUS_BADGE_CLS[overallStatus])}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', overallStatus !== 'unknown' ? 'animate-pulse' : '', STATUS_DOT[overallStatus])} />
                    {STATUS_LABEL[overallStatus]}
                </span>
            </div>

            {/* Provider summary cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="border"><CardContent className="p-4 space-y-3">
                        <Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /><Skeleton className="h-1.5 w-full" />
                    </CardContent></Card>
                )) : providerSummary.map(({ provider, status, latencyMs, avgUptime }) => {
                    const meta = PROVIDER_LABELS[provider] ?? { label: provider, icon: '○' };
                    return (
                        <button key={provider} onClick={() => setFilterProvider(f => f === provider ? 'all' : provider)}
                            className={cn('text-left rounded-xl border p-4 space-y-3 transition-all hover:shadow-md cursor-pointer',
                                filterProvider === provider ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-primary/40'
                            )}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg leading-none">{meta.icon}</span>
                                    <div>
                                        <p className="font-semibold text-sm">{meta.label}</p>
                                        <LatencyBadge ms={latencyMs ? Math.round(latencyMs) : null} />
                                    </div>
                                </div>
                                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium', STATUS_BADGE_CLS[status])}>
                                    <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[status])} />
                                    {STATUS_LABEL[status]}
                                </span>
                            </div>
                            <UptimeBar percent={avgUptime} />
                        </button>
                    );
                })}
            </div>

            {/* Provider filter */}
            {!isLoading && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Filter:</span>
                    {['all', ...providers].map(p => (
                        <button key={p} onClick={() => setFilterProvider(p)}
                            className={cn('px-3 py-1 rounded-full text-xs border transition-colors',
                                filterProvider === p ? 'bg-primary text-primary-foreground border-primary' :
                                    'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                            )}>
                            {p === 'all' ? 'All Providers' : PROVIDER_LABELS[p]?.label ?? p}
                        </button>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">{filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''}</span>
                </div>
            )}

            {/* Per-model table */}
            {isLoading ? (
                <Card className="border"><CardContent className="p-0 divide-y">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-4 py-3">
                            <Skeleton className="h-2 w-2 rounded-full" />
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-16 ml-auto" />
                        </div>
                    ))}
                </CardContent></Card>
            ) : (
                <Card className="border overflow-hidden">
                    <div className="flex text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 border-b bg-muted/30 gap-4">
                        <span className="flex-1">Model</span>
                        <span className="w-24 text-center hidden sm:block">Status</span>
                        <span className="w-24 text-right hidden md:block">Latency (p50/p95)</span>
                        <span className="w-24 text-right">24h Uptime</span>
                    </div>
                    <div className="divide-y overflow-y-auto max-h-[600px]">
                        {filteredModels.length === 0 ? (
                            <div className="py-16 text-center text-muted-foreground">
                                <Server className="h-8 w-8 mx-auto mb-3 opacity-40" />
                                <p className="font-medium text-foreground">No status data yet</p>
                                <p className="text-sm mt-1">Click "Run Health Check" to probe all models</p>
                            </div>
                        ) : filteredModels.map(m => (
                            <div key={m.modelId} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[m.status])} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{m.displayName}</p>
                                    <p className="text-[10px] font-mono text-muted-foreground truncate">{m.modelId}</p>
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        <CategoryBadge category={m.category} />
                                        {m.supportsVision && <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-blue-500 border-blue-500/30">Vision</Badge>}
                                    </div>
                                </div>
                                <span className={cn('hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium w-24 justify-center', STATUS_BADGE_CLS[m.status])}>
                                    {STATUS_LABEL[m.status]}
                                </span>
                                <div className="hidden md:flex w-24 flex-col items-end gap-0.5 px-1">
                                    <div className="flex items-center gap-1 text-[10px]">
                                        <span className="text-muted-foreground">p50:</span>
                                        <LatencyBadge ms={m.metrics?.p50 || m.latencyMs} />
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px]">
                                        <span className="text-muted-foreground">p95:</span>
                                        <LatencyBadge ms={m.metrics?.p95 || null} />
                                    </div>
                                </div>
                                <div className="w-24 flex flex-col items-end gap-1">
                                    <span className={cn('text-xs font-mono font-semibold',
                                        m.uptimePercent >= 98 ? 'text-green-500' : m.uptimePercent >= 90 ? 'text-amber-500' : 'text-red-500'
                                    )}>{m.uptimePercent}%</span>
                                    <div className="h-1 w-20 rounded-full bg-muted overflow-hidden">
                                        <div className={cn('h-full rounded-full',
                                            m.uptimePercent >= 98 ? 'bg-green-500' : m.uptimePercent >= 90 ? 'bg-amber-400' : 'bg-red-500'
                                        )} style={{ width: `${m.uptimePercent}%` }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Incident History Timeline */}
            <Card className="border overflow-hidden">
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" /> Incident History
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {data?.incidentHistory && data.incidentHistory.length > 0 ? (
                            data.incidentHistory.slice(0, 10).map((inc, i) => (
                                <div key={i} className="flex items-start gap-3 p-4 hover:bg-muted/10 transition-colors">
                                    <div className="flex flex-col items-center mt-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm ring-4 ring-green-500/10" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="font-semibold text-sm capitalize">{inc.provider} Infrastructure</span>
                                            <Badge variant="secondary" className="text-[10px] px-1.5 h-4 bg-green-500/10 text-green-600 dark:text-green-400 border-none">Resolved</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-1 mb-2 font-mono bg-muted/30 px-2 py-1 rounded">
                                            {inc.errorMessage}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground/70">
                                            <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> {new Date(inc.startedAt).toLocaleDateString()}</span>
                                            <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {new Date(inc.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="flex items-center gap-1 font-medium text-foreground/80">
                                                <Timer className="h-2.5 w-2.5" />
                                                Resolved in {inc.resolvedAt ? `${Math.round((new Date(inc.resolvedAt).getTime() - new Date(inc.startedAt).getTime()) / 60000)} min` : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center text-muted-foreground bg-muted/5">
                                <ShieldCheck className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-medium">All systems have been 100% stable recently.</p>
                                <p className="text-xs mt-1">Incidents will appear here if they occur.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground pt-2 border-t">
                <div className="flex flex-wrap gap-4">
                    {Object.entries(STATUS_DOT).map(([s, dot]) => (
                        <div key={s} className="flex items-center gap-1.5">
                            <span className={cn('w-2 h-2 rounded-full', dot)} />
                            {STATUS_LABEL[s]}
                        </div>
                    ))}
                </div>
                <span className="sm:ml-auto">Auto-refreshes every 60s. Probes run every 10 minutes.</span>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const AiGatewayPage = () => {
    const { isSignedIn } = useAuthState();
    const navigate = useNavigate();

    useEffect(() => { if (!isSignedIn) navigate('/signin'); }, [isSignedIn, navigate]);

    const { data: modelsData, isLoading: modelsLoading } = useQuery({
        queryKey: ['ai-gateway-models'],
        queryFn: () => apiRequest<ModelsResponse>(`${API_BASE}/v1/models`),
        staleTime: 5 * 60_000,
    });

    const { data: balanceData } = useQuery({
        queryKey: ['ai-gateway-balance'],
        queryFn: () => apiRequest<GatewayBalance>(`${API_BASE}/api/v1/ai-gateway/balance`),
        enabled: isSignedIn,
        staleTime: 30_000,
    });

    const { data: apiKeysData } = useQuery({
        queryKey: ['api-keys'],
        queryFn: () => apiRequest<ApiKeysResponse>(`${API_BASE}/api/v1/api-keys`),
        enabled: isSignedIn,
        staleTime: 60_000,
    });

    const models = modelsData?.data ?? [];
    const balance = balanceData?.data?.credits ?? 0;
    const apiKeys = apiKeysData?.data ?? [];
    const defaultModel = models.find(m => m.category === 'fast')?.id || models[0]?.id;

    if (!isSignedIn) return null;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/10"><Bot className="h-5 w-5 text-primary" /></div>
                            <h1 className="text-2xl font-bold tracking-tight">AI Gateway</h1>
                            <Badge variant="secondary" className="text-xs">Beta</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm max-w-xl">
                            OpenAI-compatible API gateway. Access {models.length} models across multiple capability tiers — text, vision, reasoning, and coding.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">Credit Balance</p>
                            <p className="text-xl font-bold font-mono">{balance.toLocaleString()}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/credits')}>
                            <CircleDollarSign className="h-3.5 w-3.5 mr-1.5" />Buy Credits
                        </Button>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Available Models', value: modelsLoading ? '—' : models.length.toString(), icon: <Bot className="h-4 w-4" />, sub: `${models.filter(m => m.supports_vision).length} with vision` },
                        { label: 'Vision Models', value: modelsLoading ? '—' : models.filter(m => m.supports_vision).length.toString(), icon: <Eye className="h-4 w-4" />, sub: 'Image understanding' },
                        { label: 'API Compatible', value: 'OpenAI', icon: <Code2 className="h-4 w-4" />, sub: 'Drop-in SDK support' },
                        { label: 'Caching', value: 'Enabled', icon: <Zap className="h-4 w-4" />, sub: '5 min default TTL' },
                    ].map(({ label, value, icon, sub }) => (
                        <Card key={label} className="border"><CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
                            <p className="font-bold text-lg">{value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                        </CardContent></Card>
                    ))}
                </div>

                {/* Tabs */}
                <Tabs defaultValue="playground" className="space-y-6">
                    <TabsList className="bg-muted/50 p-1">
                        <TabsTrigger value="playground" className="text-xs sm:text-sm gap-2"><Bot className="h-4 w-4" /> Playground</TabsTrigger>
                        <TabsTrigger value="models" className="text-xs sm:text-sm gap-2"><Layers className="h-4 w-4" /> Models</TabsTrigger>
                        <TabsTrigger value="status" className="text-xs sm:text-sm gap-2"><Server className="h-4 w-4" /> Status</TabsTrigger>
                        <TabsTrigger value="usage" className="text-xs sm:text-sm gap-2"><Activity className="h-4 w-4" /> Usage</TabsTrigger>
                        <TabsTrigger value="docs" className="text-xs sm:text-sm gap-2"><Book className="h-4 w-4" /> Docs</TabsTrigger>
                    </TabsList>

                    <TabsContent value="playground" className="mt-0">
                        <Playground models={models} />
                    </TabsContent>
                    <TabsContent value="models" className="mt-0">
                        <ModelsExplorer models={models} isLoading={modelsLoading} />
                    </TabsContent>
                    <TabsContent value="status" className="mt-0">
                        <StatusMonitor />
                    </TabsContent>
                    <TabsContent value="usage" className="mt-0">
                        <UsageStatsPanel />
                    </TabsContent>
                    <TabsContent value="docs" className="mt-0">
                        <ApiReference apiKeys={apiKeys} defaultModel={defaultModel} />
                    </TabsContent>
                </Tabs>

                <div className="border-t pt-6 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <Tag className="h-3 w-3" />
                        <span>Credits charged on successful responses only. System prompt tokens are billed per request. We Never Log Your Data or train any model on it.</span>
                    </div>
                    <span>FairArena AI Gateway · OpenAI API compatible</span>
                </div>
            </div>
        </div>
    );
};

export default AiGatewayPage;
