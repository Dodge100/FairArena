import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, apiRequest } from '@/lib/apiClient';
import { useAuthState } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
    Activity,
    Book,
    Bot,
    Check,
    ChevronRight,
    CircleDollarSign,
    ClipboardCopy,
    Code2,
    Eye,
    EyeOff,
    Flame,
    Gauge,
    Globe,
    Key,
    Layers,
    Loader2,
    MessageSquare,
    RefreshCw,
    Send,
    Tag,
    Terminal,
    TrendingDown,
    Wrench,
    Zap
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelConfig {
    id: string;
    owned_by: string;
    display_name: string;
    description: string;
    context_window: number;
    max_output_tokens: number;
    supports_streaming: boolean;
    supports_vision: boolean;
    supports_tool_calling: boolean;
    pricing: {
        input_credits_per_1k_tokens: number;
        output_credits_per_1k_tokens: number;
    };
    tags: string[];
}

interface ProviderMetadata {
    label: string;
    color: string;
    icon: string;
}

interface ModelsResponse {
    object: string;
    data: ModelConfig[];
    total: number;
    providers: Record<string, ProviderMetadata>;
    stats: Record<string, number>;
}

interface GatewayBalance {
    success: boolean;
    data: { credits: number; userId: string };
}

interface UsageStats {
    success: boolean;
    data: {
        period: string;
        summary: {
            totalRequests: number;
            totalCreditsUsed: number;
            totalTokens: number;
            promptTokens: number;
            completionTokens: number;
            averageLatencyMs: number;
        };
        modelBreakdown: Array<{
            model: string;
            provider: string;
            requests: number;
            creditsUsed: number;
            tokens: number;
        }>;
        recentRequests: Array<{
            id: string;
            model: string;
            provider: string;
            promptTokens: number;
            completionTokens: number;
            creditsUsed: number;
            latencyMs: number;
            streaming: boolean;
            cached: boolean;
            status: string;
            createdAt: string;
        }>;
    };
}

interface ApiKeysResponse {
    success: boolean;
    data: Array<{ id: string; name: string; prefix: string; lastUsedAt?: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// No hardcoded PROVIDER_LABELS here anymore

const STATUS_COLORS: Record<string, string> = {
    SUCCESS: 'text-green-500',
    ERROR: 'text-red-500',
    RATE_LIMITED: 'text-yellow-500',
    INSUFFICIENT_CREDITS: 'text-orange-500',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={copy}
            className={cn(
                'p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground',
                className,
            )}
            title="Copy"
        >
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
            <pre className="p-4 text-xs font-mono overflow-x-auto text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {code}
            </pre>
        </div>
    );
}

function ModelBadge({ provider, metadata }: { provider: string; metadata?: ProviderMetadata }) {
    const cfg = metadata ?? { label: provider, color: 'bg-secondary text-foreground border-border', icon: '○' };
    return (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium', cfg.color)}>
            <span>{cfg.icon}</span>
            {cfg.label}
        </span>
    );
}

// ─── Playground ───────────────────────────────────────────────────────────────

function Playground({ models, providerMetadata }: { models: ModelConfig[]; providerMetadata: Record<string, ProviderMetadata> }) {
    const [selectedModel, setSelectedModel] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.');
    const [userMessage, setUserMessage] = useState('');
    const [response, setResponse] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [loading, setLoading] = useState(false);
    const [latency, setLatency] = useState<number | null>(null);
    const [usage, setUsage] = useState<{ prompt: number; completion: number; credits: number } | null>(null);
    const [streamEnabled, setStreamEnabled] = useState(true);
    const abortRef = useRef<AbortController | null>(null);

    // Pick default model
    useEffect(() => {
        if (models.length && !selectedModel) {
            const preferred = models.find((m) => m.owned_by === 'groq');
            setSelectedModel(preferred?.id ?? models[0]?.id ?? '');
        }
    }, [models, selectedModel]);

    const selectedModelConfig = models.find((m) => m.id === selectedModel);

    const send = useCallback(async () => {
        if (!userMessage.trim() || !selectedModel || loading) return;
        setLoading(true);
        setResponse('');
        setLatency(null);
        setUsage(null);

        const start = Date.now();
        abortRef.current = new AbortController();

        try {
            const body = {
                model: selectedModel,
                stream: streamEnabled && selectedModelConfig?.supports_streaming,
                messages: [
                    ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: userMessage },
                ],
                max_tokens: 1024,
            };

            const res = await apiFetch(`${API_BASE}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: abortRef.current.signal,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
                throw new Error(err?.error?.message ?? 'Request failed');
            }

            if (body.stream && res.body) {
                setIsStreaming(true);
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buf = '';
                let text = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split('\n');
                    buf = lines.pop() ?? '';
                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const json = line.slice(6).trim();
                        if (!json || json === '[DONE]') continue;
                        try {
                            const chunk = JSON.parse(json);
                            const delta = chunk.choices?.[0]?.delta?.content ?? '';
                            text += delta;
                            setResponse(text);
                        } catch { /* skip */ }
                    }
                }
                setIsStreaming(false);
                setLatency(Date.now() - start);
            } else {
                const data = await res.json();
                const content = data.choices?.[0]?.message?.content ?? '';
                setResponse(content);
                setLatency(Date.now() - start);
                if (data.usage) {
                    setUsage({
                        prompt: data.usage.prompt_tokens,
                        completion: data.usage.completion_tokens,
                        credits: data.x_fairarena?.credits_used ?? 0,
                    });
                }
            }
        } catch (err: unknown) {
            if ((err as Error).name === 'AbortError') {
                setResponse((prev) => prev + '\n\n[Stopped]');
            } else {
                toast.error((err as Error).message ?? 'Request failed');
                setResponse('');
            }
            setIsStreaming(false);
        } finally {
            setLoading(false);
        }
    }, [userMessage, selectedModel, loading, streamEnabled, selectedModelConfig, systemPrompt]);

    const stop = () => {
        abortRef.current?.abort();
        setIsStreaming(false);
        setLoading(false);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full">
            {/* Left: Config */}
            <div className="lg:col-span-2 space-y-4">
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Bot className="h-4 w-4 text-primary" />
                            Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Model selector */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Model</label>
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select model..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                    {Object.entries(providerMetadata).map(([id, cfg]) => {
                                        const group = models.filter((m) => m.owned_by === id);
                                        if (!group.length) return null;
                                        return (
                                            <div key={id}>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                                                    <span>{cfg.icon}</span> {cfg.label}
                                                </div>
                                                {group.map((m) => (
                                                    <SelectItem key={m.id} value={m.id} className="text-sm pl-5">
                                                        <span className="truncate">{m.display_name}</span>
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            {selectedModelConfig && (
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                    <ModelBadge provider={selectedModelConfig.owned_by} metadata={providerMetadata[selectedModelConfig.owned_by]} />
                                    <span className="text-xs text-muted-foreground">
                                        {(selectedModelConfig.context_window / 1000).toFixed(0)}k ctx
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {selectedModelConfig.pricing.input_credits_per_1k_tokens} cr/1k in
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* System Prompt */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">System Prompt</label>
                            <Textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                placeholder="System instructions..."
                                className="text-sm min-h-[80px] resize-none font-mono"
                                rows={3}
                            />
                        </div>

                        {/* Stream toggle */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Streaming</span>
                            <button
                                onClick={() => setStreamEnabled((v) => !v)}
                                className={cn(
                                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                                    streamEnabled && selectedModelConfig?.supports_streaming
                                        ? 'bg-primary'
                                        : 'bg-muted',
                                )}
                                disabled={!selectedModelConfig?.supports_streaming}
                            >
                                <span
                                    className={cn(
                                        'pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform',
                                        streamEnabled && selectedModelConfig?.supports_streaming ? 'translate-x-4' : 'translate-x-0',
                                    )}
                                />
                            </button>
                        </div>

                        {/* Capabilities */}
                        {selectedModelConfig && (
                            <div className="space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">Capabilities</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedModelConfig.supports_streaming && (
                                        <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                            <Zap className="h-2.5 w-2.5" /> Streaming
                                        </Badge>
                                    )}
                                    {selectedModelConfig.supports_vision && (
                                        <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                            <Eye className="h-2.5 w-2.5" /> Vision
                                        </Badge>
                                    )}
                                    {selectedModelConfig.supports_tool_calling && (
                                        <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                            <Wrench className="h-2.5 w-2.5" /> Tools
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Usage Metadata */}
                {(latency !== null || usage) && (
                    <Card className="border shadow-sm">
                        <CardContent className="p-4 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response Metadata</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {latency !== null && (
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">Latency</p>
                                        <p className="font-mono font-semibold">{latency.toLocaleString()}ms</p>
                                    </div>
                                )}
                                {usage && (
                                    <>
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground">Prompt tokens</p>
                                            <p className="font-mono font-semibold">{usage.prompt}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground">Completion</p>
                                            <p className="font-mono font-semibold">{usage.completion}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground">Credits used</p>
                                            <p className="font-mono font-semibold text-primary">{usage.credits}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Right: Chat */}
            <div className="lg:col-span-3 flex flex-col gap-4">
                <Card className="border shadow-sm flex-1 flex flex-col min-h-[420px]">
                    <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            Chat
                            {isStreaming && (
                                <Badge variant="secondary" className="text-[10px] animate-pulse ml-auto">Streaming...</Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 overflow-y-auto">
                        {!response && !loading && (
                            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
                                <div className="p-4 rounded-full bg-muted">
                                    <Bot className="h-8 w-8" />
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">Select a model and start chatting</p>
                                    <p className="text-sm mt-1">Select a model and start chatting</p>
                                </div>
                            </div>
                        )}
                        {loading && !response && (
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Thinking...</span>
                            </div>
                        )}
                        {response && (
                            <div className="relative group">
                                <CopyButton text={response} className="absolute top-0 right-0 opacity-0 group-hover:opacity-100" />
                                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground pr-8">
                                    {response}
                                    {isStreaming && (
                                        <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                                    )}
                                </pre>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Input */}
                <div className="space-y-2">
                    <Textarea
                        id="playground-input"
                        value={userMessage}
                        onChange={(e) => setUserMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
                        }}
                        placeholder="Type your message... (Ctrl+Enter to send)"
                        className="text-sm min-h-[80px] resize-none"
                        rows={3}
                        disabled={loading}
                    />
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            {userMessage.length > 0 && `${userMessage.length} chars · ~${Math.ceil(userMessage.length / 4)} tokens`}
                        </p>
                        <div className="flex gap-2">
                            {(loading || isStreaming) && (
                                <Button variant="outline" size="sm" onClick={stop} className="h-9">
                                    Stop
                                </Button>
                            )}
                            <Button
                                id="playground-send-btn"
                                size="sm"
                                onClick={send}
                                disabled={!userMessage.trim() || !selectedModel || loading}
                                className="h-9 px-5"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="h-3.5 w-3.5 mr-1.5" />
                                        Send
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Models Explorer ──────────────────────────────────────────────────────────

function ModelsExplorer({ models, isLoading, providerMetadata }: { models: ModelConfig[]; isLoading: boolean; providerMetadata: Record<string, ProviderMetadata> }) {
    const [filterProvider, setFilterProvider] = useState<string>('all');
    const [search, setSearch] = useState('');

    const filtered = models.filter((m) => {
        if (filterProvider !== 'all' && m.owned_by !== filterProvider) return false;
        if (search && !m.display_name.toLowerCase().includes(search.toLowerCase()) && !m.id.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    if (isLoading) {
        return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="border">
                        <CardContent className="p-4 space-y-3">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-2/3" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <input
                    type="text"
                    placeholder="Search models..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring w-48"
                />
                <Select value={filterProvider} onValueChange={setFilterProvider}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All providers</SelectItem>
                        {Object.entries(providerMetadata).map(([id, cfg]) => (
                            <SelectItem key={id} value={id}>
                                {cfg.icon} {cfg.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground ml-auto">
                    {filtered.length} model{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Grid */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((model) => (
                    <Card
                        key={model.id}
                        className="border hover:border-primary/40 transition-colors group"
                    >
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">{model.display_name}</p>
                                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{model.id}</p>
                                </div>
                                <ModelBadge provider={model.owned_by} metadata={providerMetadata[model.owned_by]} />
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-2">{model.description}</p>

                            {/* Specs */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <Layers className="h-3 w-3 shrink-0" />
                                    <span>{(model.context_window / 1000).toFixed(0)}k ctx</span>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <CircleDollarSign className="h-3 w-3 shrink-0" />
                                    <span>{model.pricing.input_credits_per_1k_tokens} cr/1k in · {model.pricing.output_credits_per_1k_tokens} out</span>
                                </div>
                            </div>

                            {/* Capability badges */}
                            <div className="flex flex-wrap gap-1">
                                {model.supports_streaming && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                        Streaming
                                    </Badge>
                                )}
                                {model.supports_vision && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                        Vision
                                    </Badge>
                                )}
                                {model.supports_tool_calling && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                        Tools
                                    </Badge>
                                )}
                                {model.tags?.slice(0, 2).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] h-4 px-1.5">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {filtered.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                    <Globe className="h-8 w-8 mx-auto mb-3 opacity-40" />
                    <p>No models match your filter</p>
                </div>
            )}
        </div>
    );
}

// ─── Usage Stats ──────────────────────────────────────────────────────────────

function UsageStats({ providerMetadata }: { providerMetadata: Record<string, ProviderMetadata> }) {
    const [days, setDays] = useState(30);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['ai-gateway-usage', days],
        queryFn: () =>
            apiRequest<UsageStats>(`${API_BASE}/api/v1/ai-gateway/usage?days=${days}`).then((r) => r.data),
        staleTime: 30_000,
    });

    const stats = data;
    const summary = data?.summary;

    return (
        <div className="space-y-6">
            {/* Period selector */}
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Usage Statistics</h2>
                <div className="flex items-center gap-2">
                    <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                        <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()}>
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="border">
                            <CardContent className="p-4">
                                <Skeleton className="h-3 w-20 mb-2" />
                                <Skeleton className="h-7 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        {
                            label: 'Total Requests',
                            value: summary?.totalRequests.toLocaleString() ?? '0',
                            icon: <Activity className="h-4 w-4" />,
                        },
                        {
                            label: 'Credits Used',
                            value: summary?.totalCreditsUsed.toLocaleString() ?? '0',
                            icon: <CircleDollarSign className="h-4 w-4" />,
                        },
                        {
                            label: 'Total Tokens',
                            value: summary?.totalTokens ? `${(summary.totalTokens / 1000).toFixed(1)}k` : '0',
                            icon: <Layers className="h-4 w-4" />,
                        },
                        {
                            label: 'Avg Latency',
                            value: summary?.averageLatencyMs ? `${summary.averageLatencyMs}ms` : '—',
                            icon: <Gauge className="h-4 w-4" />,
                        },
                    ].map(({ label, value, icon }) => (
                        <Card key={label} className="border">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    {icon}
                                    <span className="text-xs">{label}</span>
                                </div>
                                <p className="text-2xl font-bold font-mono">{value}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Model breakdown */}
            {stats && stats.modelBreakdown.length > 0 && (
                <Card className="border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">By Model</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {stats.modelBreakdown.slice(0, 8).map((row) => (
                                <div key={row.model} className="flex items-center justify-between px-4 py-3 text-sm">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <ModelBadge provider={row.provider} metadata={providerMetadata[row.provider]} />
                                        <span className="font-mono text-xs truncate text-muted-foreground">{row.model}</span>
                                    </div>
                                    <div className="flex items-center gap-6 shrink-0 text-xs text-right">
                                        <div>
                                            <div className="font-medium">{row.requests}</div>
                                            <div className="text-muted-foreground">reqs</div>
                                        </div>
                                        <div>
                                            <div className="font-medium">{row.creditsUsed}</div>
                                            <div className="text-muted-foreground">credits</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recent requests */}
            {stats && stats.recentRequests.length > 0 && (
                <Card className="border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Recent Requests</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    {['Model', 'Status', 'Tokens', 'Credits', 'Latency', 'Time'].map((h) => (
                                        <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stats.recentRequests.slice(0, 20).map((req) => (
                                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-2 font-mono max-w-[180px] truncate">{req.model}</td>
                                        <td className="px-4 py-2">
                                            <span className={cn('font-medium', STATUS_COLORS[req.status] ?? 'text-foreground')}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 font-mono whitespace-nowrap">
                                            {req.promptTokens + req.completionTokens}
                                        </td>
                                        <td className="px-4 py-2 font-mono">{req.creditsUsed}</td>
                                        <td className="px-4 py-2 font-mono whitespace-nowrap">
                                            {req.cached ? <span className="text-blue-500">cached</span> : `${req.latencyMs}ms`}
                                        </td>
                                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                                            {new Date(req.createdAt).toLocaleTimeString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {!isLoading && (!stats || (summary?.totalRequests ?? 0) === 0) && (
                <div className="text-center py-16 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-3 opacity-40" />
                    <p className="font-medium text-foreground">No usage yet</p>
                    <p className="text-sm mt-1">Send your first request in the Playground tab</p>
                </div>
            )}
        </div>
    );
}

// ─── API Reference ────────────────────────────────────────────────────────────

function ApiReference({ apiKeys, defaultModel }: { apiKeys: Array<{ id: string; name: string; prefix: string }>; defaultModel?: string }) {
    const [showKeyActual, setShowKeyActual] = useState(false);
    const hasKey = apiKeys.length > 0;
    const keyPlaceholder = hasKey ? `${apiKeys[0].prefix}...` : 'fa_live_YOUR_KEY';
    const navigate = useNavigate();
    const activeModel = defaultModel || 'groq/llama-3.1-8b-instant';

    const curlExample = `curl ${import.meta.env.VITE_API_BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer ${keyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${activeModel}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

    const jsExample = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${keyPlaceholder}",
  baseURL: "${import.meta.env.VITE_API_BASE_URL}/v1",
});

const chat = await client.chat.completions.create({
  model: "${activeModel}",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(chat.choices[0].message.content);`;

    const pyExample = `from openai import OpenAI

client = OpenAI(
    api_key="${keyPlaceholder}",
    base_url="${import.meta.env.VITE_API_BASE_URL}/v1",
)

response = client.chat.completions.create(
    model="${activeModel}",
    messages=[{"role": "user", "content": "Hello!"}],
)

print(response.choices[0].message.content)`;

    const streamExample = `const response = await fetch(
  "${import.meta.env.VITE_API_BASE_URL}/v1/chat/completions",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer ${keyPlaceholder}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "${activeModel}",
      messages: [{ role: "user", content: "Write a poem" }],
      stream: true,
    }),
  }
);

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  const lines = chunk.split("\\n").filter(l => l.startsWith("data: "));
  for (const line of lines) {
    const json = line.slice(6);
    if (json === "[DONE]") break;
    const data = JSON.parse(json);
    process.stdout.write(data.choices[0]?.delta?.content ?? "");
  }
}`;

    return (
        <div className="space-y-8 max-w-3xl">
            {/* API Key setup */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">Authentication</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                    Use your FairArena API key as a Bearer token. You can also call the gateway via your existing session
                    cookie for in-browser requests.
                </p>

                {!hasKey ? (
                    <Card className="border border-dashed">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-primary/10">
                                    <Key className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">No API keys yet</p>
                                    <p className="text-xs text-muted-foreground">Create one to access the gateway programmatically</p>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/account-settings')}>
                                Create API Key <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                        <Key className="h-4 w-4 text-primary shrink-0" />
                        <code className="text-sm font-mono flex-1">
                            {showKeyActual ? apiKeys[0].prefix + '...' : '••••••••••••••••'}
                        </code>
                        <button
                            onClick={() => setShowKeyActual((v) => !v)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                            {showKeyActual ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                )}
            </div>

            {/* Base URL */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">Base URL</h2>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30 font-mono text-sm">
                    <span className="flex-1 text-muted-foreground">{import.meta.env.VITE_API_BASE_URL}/v1</span>
                    <CopyButton text={`${import.meta.env.VITE_API_BASE_URL}/v1`} />
                </div>
                <p className="text-xs text-muted-foreground">
                    Drop-in compatible with the <strong>OpenAI SDK</strong> — just change <code className="bg-muted px-1 rounded">baseURL</code>.
                </p>
            </div>

            {/* Code examples */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">Quick Start</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">cURL</p>
                        <CodeBlock code={curlExample} lang="bash" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">JavaScript / TypeScript (OpenAI SDK)</p>
                        <CodeBlock code={jsExample} lang="typescript" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Python (OpenAI SDK)</p>
                        <CodeBlock code={pyExample} lang="python" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Streaming (Fetch API)</p>
                        <CodeBlock code={streamExample} lang="javascript" />
                    </div>
                </div>
            </div>

            {/* Endpoints table */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">Endpoints</h2>
                </div>
                <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/30">
                                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Method</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Path</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { method: 'POST', path: '/v1/chat/completions', desc: 'Chat completions (streaming + non-streaming)' },
                                { method: 'GET', path: '/v1/models', desc: 'List available models' },
                                { method: 'GET', path: '/v1/models/:id', desc: 'Get model details' },
                                { method: 'GET', path: '/v1/usage', desc: 'Usage statistics' },
                                { method: 'GET', path: '/v1/balance', desc: 'Current credit balance' },
                            ].map(({ method, path, desc }) => (
                                <tr key={path} className="hover:bg-muted/20">
                                    <td className="px-4 py-2.5">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'text-[10px] font-mono font-bold',
                                                method === 'POST' ? 'text-green-600' : 'text-blue-600',
                                            )}
                                        >
                                            {method}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{path}</td>
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Rate limits & credit info */}
            <div className="grid sm:grid-cols-2 gap-4">
                <Card className="border">
                    <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Flame className="h-4 w-4 text-orange-500" />
                            Rate Limits
                        </div>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                            <li className="flex items-center gap-1.5"><ChevronRight className="h-3 w-3 shrink-0" /> 60 requests / minute per user</li>
                            <li className="flex items-center gap-1.5"><ChevronRight className="h-3 w-3 shrink-0" /> Sliding window — no burst penalty</li>
                            <li className="flex items-center gap-1.5"><ChevronRight className="h-3 w-3 shrink-0" /> 429 status when exceeded</li>
                        </ul>
                    </CardContent>
                </Card>
                <Card className="border">
                    <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <TrendingDown className="h-4 w-4 text-primary" />
                            Caching
                        </div>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                            <li className="flex items-center gap-1.5"><ChevronRight className="h-3 w-3 shrink-0" /> Identical non-streaming requests cached 5 min</li>
                            <li className="flex items-center gap-1.5"><ChevronRight className="h-3 w-3 shrink-0" /> Cached responses use 0 credits</li>
                            <li className="flex items-center gap-1.5"><ChevronRight className="h-3 w-3 shrink-0" /> Disable with <code className="bg-muted px-1 rounded">"cache": false</code></li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const AiGatewayPage = () => {
    const { isSignedIn } = useAuthState();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isSignedIn) navigate('/signin');
    }, [isSignedIn, navigate]);

    const { data: modelsData, isLoading: modelsLoading } = useQuery({
        queryKey: ['ai-gateway-models'],
        queryFn: () =>
            apiRequest<ModelsResponse>(`${API_BASE}/v1/models`),
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
    const providerMetadata = modelsData?.providers ?? {};
    const balance = balanceData?.data?.credits ?? 0;
    const apiKeys = apiKeysData?.data ?? [];
    const defaultModel = models.find(m => m.owned_by === 'groq')?.id || models[0]?.id;

    if (!isSignedIn) return null;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/10">
                                <Bot className="h-5 w-5 text-primary" />
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight">AI Gateway</h1>
                            <Badge variant="secondary" className="text-xs">Beta</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm max-w-xl">
                            OpenAI-compatible API gateway with unified access to Groq, Gemini, and OpenRouter models.
                            Drop-in replacement for the OpenAI SDK.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">Credit Balance</p>
                            <p className="text-xl font-bold font-mono">{balance.toLocaleString()}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/credits')}>
                            <CircleDollarSign className="h-3.5 w-3.5 mr-1.5" />
                            Buy Credits
                        </Button>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        {
                            label: 'Available Models',
                            value: modelsLoading ? '—' : models.length.toString(),
                            icon: <Bot className="h-4 w-4" />,
                            sub: `${modelsData?.providers?.groq ?? 0} Groq · ${modelsData?.providers?.gemini ?? 0} Gemini`,
                        },
                        {
                            label: 'Tool Fallback',
                            value: 'Enabled',
                            icon: <Wrench className="h-4 w-4" />,
                            sub: 'Works on all models',
                        },
                        {
                            label: 'API Endpoint',
                            value: 'OpenAI Compat',
                            icon: <Code2 className="h-4 w-4" />,
                            sub: 'Drop-in SDK support',
                        },
                        {
                            label: 'Caching',
                            value: 'Enabled',
                            icon: <Zap className="h-4 w-4" />,
                            sub: '5 min default TTL',
                        },
                    ].map(({ label, value, icon, sub }) => (
                        <Card key={label} className="border">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    {icon}
                                    <span className="text-xs">{label}</span>
                                </div>
                                <p className="font-bold text-lg">{value}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Main tabs */}
                <Tabs defaultValue="playground" className="space-y-6">
                    <TabsList className="bg-muted/50 p-1">
                        <TabsTrigger value="playground" className="text-xs sm:text-sm gap-2">
                            <Bot className="h-4 w-4" /> Playground
                        </TabsTrigger>
                        <TabsTrigger value="models" className="text-xs sm:text-sm gap-2">
                            <Layers className="h-4 w-4" /> Models
                        </TabsTrigger>
                        <TabsTrigger value="usage" className="text-xs sm:text-sm gap-2">
                            <Activity className="h-4 w-4" /> Usage
                        </TabsTrigger>
                        <TabsTrigger value="docs" className="text-xs sm:text-sm gap-2">
                            <Book className="h-4 w-4" /> Docs
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="playground" className="mt-0">
                        <Playground models={models} providerMetadata={providerMetadata} />
                    </TabsContent>

                    <TabsContent value="models" className="mt-0">
                        <ModelsExplorer models={models} isLoading={modelsLoading} providerMetadata={providerMetadata} />
                    </TabsContent>

                    <TabsContent value="usage" className="mt-0">
                        <UsageStats providerMetadata={providerMetadata} />
                    </TabsContent>

                    <TabsContent value="docs" className="mt-0">
                        <ApiReference apiKeys={apiKeys} defaultModel={defaultModel} />
                    </TabsContent>
                </Tabs>

                {/* Footer note */}
                <div className="border-t pt-6 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <Tag className="h-3 w-3" />
                        <span>Free models consume 0 credits. Paid models are billed per 1,000 tokens.</span>
                    </div>
                    <span>FairArena AI Gateway · OpenAI API compatible</span>
                </div>
            </div>
        </div>
    );
};

export default AiGatewayPage;
