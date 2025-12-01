import { Copy, Maximize2, Minimize2, RotateCcw, Send, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AISidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export function AISidebar({ isOpen, onClose }: AISidebarProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(420);
    const [isResizing, setIsResizing] = useState(false);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(() => {
        return localStorage.getItem('ai-terms-accepted') === 'true';
    });
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [messageFeedback, setMessageFeedback] = useState<Record<string, 'like' | 'dislike'>>({});
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Simulate AI response - replace with actual API call
        setTimeout(() => {
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'I\'m your AI assistant! I can help you with:\n\n• Navigating the platform\n• Understanding features\n• Answering questions\n• Providing guidance\n\nWhat would you like to know?',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            setIsLoading(false);
        }, 1000);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const copyMessage = async (content: string, messageId: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            // Reset the copied state after 2 seconds
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleFeedback = (messageId: string, feedback: 'like' | 'dislike') => {
        setMessageFeedback(prev => ({
            ...prev,
            [messageId]: feedback
        }));
        // Could send feedback to analytics/API here
    };

    const acceptTerms = () => {
        setHasAcceptedTerms(true);
        setShowTermsModal(false);
        localStorage.setItem('ai-terms-accepted', 'true');
    };

    const declineTerms = () => {
        setShowTermsModal(false);
        onClose(); // Close the sidebar if terms are declined
    };

    // Check if terms need to be shown when sidebar opens
    useEffect(() => {
        if (isOpen && !hasAcceptedTerms) {
            setTimeout(() => setShowTermsModal(true), 300); // Small delay for animation
        }
    }, [isOpen, hasAcceptedTerms]);

    const clearChat = () => {
        setMessages([]);
    };

    const toggleFullScreen = () => {
        setIsFullScreen(!isFullScreen);
    };

    // Resize functionality
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing || isFullScreen) return;

        const newWidth = window.innerWidth - e.clientX;
        // Constrain width between 300px and 800px
        const constrainedWidth = Math.max(300, Math.min(800, newWidth));
        setSidebarWidth(constrainedWidth);
    }, [isResizing, isFullScreen]);

    const handleMouseUp = () => {
        setIsResizing(false);
    };

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, isFullScreen, handleMouseMove]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    />

                    {/* Terms Modal */}
                    <AnimatePresence>
                        {showTermsModal && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="fixed inset-0 z-60 flex items-center justify-center p-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
                                    <div className="p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#DDEF00] to-[#DDEF00]/70 flex items-center justify-center shadow-lg">
                                                <Sparkles className="w-5 h-5 text-black" />
                                            </div>
                                            <h2 className="text-xl font-bold text-foreground">AI Terms & Privacy</h2>
                                        </div>

                                        <div className="space-y-4 text-sm text-muted-foreground">
                                            <div>
                                                <h3 className="font-semibold text-foreground mb-2">Terms of Service</h3>
                                                <p>
                                                    By using our AI assistant, you agree to use it responsibly and ethically.
                                                    The AI may provide inaccurate information, so please verify important details.
                                                </p>
                                            </div>

                                            <div>
                                                <h3 className="font-semibold text-foreground mb-2">Privacy Policy</h3>
                                                <p>
                                                    Your conversations may be used to improve our AI services. We collect
                                                    usage data and feedback to enhance the experience. Personal information
                                                    is handled according to our main privacy policy.
                                                </p>
                                            </div>

                                            <div>
                                                <h3 className="font-semibold text-foreground mb-2">Data Usage</h3>
                                                <p>
                                                    Messages are processed by our AI systems. We may retain conversations
                                                    for quality improvement and support purposes.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 mt-6">
                                            <button
                                                onClick={declineTerms}
                                                className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
                                            >
                                                Decline
                                            </button>
                                            <button
                                                onClick={acceptTerms}
                                                className="flex-1 px-4 py-2 rounded-xl bg-[#DDEF00] hover:bg-[#DDEF00]/90 text-black font-medium transition-colors"
                                            >
                                                Accept & Continue
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Sidebar */}
                    <motion.div
                        ref={sidebarRef}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className={`fixed right-0 top-0 h-full max-w-screen w-full sm:max-w-[90vw] md:max-w-[600px] bg-background border-l border-border shadow-2xl z-50 flex flex-col ${isFullScreen ? 'w-full max-w-none' : ''}`}
                        style={!isFullScreen ? { width: `${sidebarWidth}px` } : {}}
                    >
                        {/* Resize Handle */}
                        {!isFullScreen && (
                            <div
                                className="absolute left-0 top-0 bottom-0 w-1 bg-border hover:bg-[#DDEF00]/50 cursor-col-resize transition-colors z-10"
                                onMouseDown={handleMouseDown}
                            />
                        )}
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border bg-linear-to-r from-[#DDEF00]/10 via-background to-background">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#DDEF00] to-[#DDEF00]/70 flex items-center justify-center shadow-lg">
                                    <Sparkles className="w-5 h-5 text-black" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">AI Assistant</h2>
                                    <p className="text-xs text-muted-foreground">Always here to help</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {messages.length > 0 && (
                                    <button
                                        onClick={clearChat}
                                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                                        title="Clear chat"
                                    >
                                        <RotateCcw className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                )}
                                <button
                                    onClick={toggleFullScreen}
                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                    title={isFullScreen ? "Exit full screen" : "Enter full screen"}
                                >
                                    {isFullScreen ? (
                                        <Minimize2 className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <Maximize2 className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 space-y-4 min-w-0">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center px-6 space-y-6">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.5 }}
                                        className="w-20 h-20 rounded-full bg-linear-to-br from-[#DDEF00] to-[#DDEF00]/60 flex items-center justify-center shadow-xl"
                                    >
                                        <Sparkles className="w-10 h-10 text-black" />
                                    </motion.div>
                                    <div>
                                        <h3 className="text-xl font-bold text-foreground mb-2">
                                            {hasAcceptedTerms ? 'How can I help you today?' : 'Welcome to AI Assistant'}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {hasAcceptedTerms
                                                ? 'Ask me anything about FairArena'
                                                : 'Please review and accept our terms to get started'
                                            }
                                        </p>
                                    </div>
                                    {hasAcceptedTerms && (
                                        <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
                                            {[
                                                'How do I get started?',
                                                'What features are available?',
                                                'How can I create a team?',
                                                'Tell me about organizations',
                                            ].map((suggestion, index) => (
                                                <motion.button
                                                    key={index}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    onClick={() => setInput(suggestion)}
                                                    className="p-3 text-sm text-left rounded-xl border border-border hover:border-[#DDEF00]/50 hover:bg-[#DDEF00]/5 transition-all"
                                                >
                                                    {suggestion}
                                                </motion.button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {messages.map((message) => (
                                        <motion.div
                                            key={message.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} px-2`}
                                        >
                                            <div
                                                className={`max-w-[90%] rounded-2xl p-4 ${message.role === 'user'
                                                    ? 'bg-[#DDEF00] text-black'
                                                    : 'bg-muted text-foreground border border-border'
                                                    }`}
                                            >
                                                <div className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
                                                    {message.content}
                                                </div>
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-current/10">
                                                    <span className="text-xs opacity-60">
                                                        {message.timestamp.toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                    {message.role === 'assistant' && (
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => copyMessage(message.content, message.id)}
                                                                className={`p-1 rounded transition-colors relative ${copiedMessageId === message.id
                                                                    ? 'bg-green-500/20 text-green-600'
                                                                    : 'hover:bg-background/50'
                                                                    }`}
                                                                title={copiedMessageId === message.id ? "Copied!" : "Copy"}
                                                            >
                                                                {copiedMessageId === message.id ? (
                                                                    <motion.div
                                                                        initial={{ scale: 0 }}
                                                                        animate={{ scale: 1 }}
                                                                        className="w-3 h-3 flex items-center justify-center"
                                                                    >
                                                                        ✓
                                                                    </motion.div>
                                                                ) : (
                                                                    <Copy className="w-3 h-3" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleFeedback(message.id, 'like')}
                                                                className={`p-1 rounded transition-colors ${messageFeedback[message.id] === 'like'
                                                                    ? 'bg-green-500/20 text-green-600'
                                                                    : 'hover:bg-background/50'
                                                                    }`}
                                                                title="Helpful"
                                                            >
                                                                <ThumbsUp className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleFeedback(message.id, 'dislike')}
                                                                className={`p-1 rounded transition-colors ${messageFeedback[message.id] === 'dislike'
                                                                    ? 'bg-red-500/20 text-red-600'
                                                                    : 'hover:bg-background/50'
                                                                    }`}
                                                                title="Not helpful"
                                                            >
                                                                <ThumbsDown className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                    {isLoading && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex justify-start px-2"
                                        >
                                            <div className="max-w-[90%] rounded-2xl p-4 bg-muted border border-border">
                                                <div className="flex gap-2">
                                                    <motion.div
                                                        animate={{ scale: [1, 1.2, 1] }}
                                                        transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                                                        className="w-2 h-2 rounded-full bg-[#DDEF00]"
                                                    />
                                                    <motion.div
                                                        animate={{ scale: [1, 1.2, 1] }}
                                                        transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                                        className="w-2 h-2 rounded-full bg-[#DDEF00]"
                                                    />
                                                    <motion.div
                                                        animate={{ scale: [1, 1.2, 1] }}
                                                        transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                                        className="w-2 h-2 rounded-full bg-[#DDEF00]"
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-2 sm:p-4 border-t border-border bg-background">
                            {hasAcceptedTerms ? (
                                <div className="flex items-end gap-2 w-full max-w-full">
                                    <div className="flex-1 relative">
                                        <textarea
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={handleKeyPress}
                                            placeholder="Type a message..."
                                            rows={1}
                                            disabled={isLoading}
                                            className="w-full p-3 pr-10 rounded-2xl border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-[#DDEF00] focus:border-transparent resize-none text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                            style={{ minHeight: '44px', maxHeight: '120px' }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isLoading}
                                        className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#DDEF00] hover:bg-[#DDEF00]/90 text-black font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none"
                                        aria-label="Send"
                                    >
                                        <Send className="w-6 h-6" />
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-muted-foreground">
                                        Please accept the terms to start chatting with AI
                                    </p>
                                    <button
                                        onClick={() => setShowTermsModal(true)}
                                        className="mt-2 px-4 py-2 rounded-xl bg-[#DDEF00] hover:bg-[#DDEF00]/90 text-black font-medium transition-colors text-sm"
                                    >
                                        Review Terms
                                    </button>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                                AI can make mistakes. Please verify important information.
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
