// @ts-nocheck
import DOMPurify from 'dompurify';
import {
  Bot,
  Copy,
  Download,
  Loader2,
  MessageSquare,
  Mic,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import { marked } from 'marked';
import { AnimatePresence, motion } from 'motion/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAIButton } from '../contexts/AIButtonContext';
import { useChat } from '../contexts/ChatContext';
import { useTheme } from '../hooks/useTheme';
import { useAuthState } from '../lib/auth';

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  aiButtonHidden: boolean;
  setAiButtonHidden: (hidden: boolean) => void;
}

// Configure marked for better markdown rendering
const renderer = new marked.Renderer();
renderer.link = (href, title, text) => {
  // Handle cases where href is an object (e.g., {href: ...})
  let safeHref = '#';
  if (typeof href === 'string') {
    safeHref = href;
  } else if (href && typeof href === 'object' && typeof href.href === 'string') {
    safeHref = href.href;
  }
  const safeTitle =
    typeof title === 'string' && title && title !== 'undefined'
      ? title.replace(/undefined/g, '')
      : '';
  return `<a href="${safeHref}"${safeTitle ? ` title="${safeTitle}"` : ''} class="text-blue-500 hover:text-blue-700 underline" target="_blank" rel="noopener noreferrer">link</a>`;
};
marked.setOptions({
  breaks: true,
  gfm: true,
  renderer,
});

export function AISidebar({ isOpen, onClose, aiButtonHidden, setAiButtonHidden }: AISidebarProps) {
  const {
    currentSession,
    isLoading,
    error,
    sendMessage,
    stopMessage,
    clearCurrentSession,
    createNewSession,
    regenerateLastMessage,
  } = useChat();
  const { position: aiButtonPosition, setPosition: setAIButtonPosition } = useAIButton();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuthState();

  const [input, setInput] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(() => {
    return localStorage.getItem('ai-terms-accepted') === 'true';
  });
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [dislikedMessages, setDislikedMessages] = useState<Set<string>>(new Set());
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoScroll, setAutoScroll] = useState(() => {
    return localStorage.getItem('ai-auto-scroll') !== 'false';
  });
  const [soundNotifications, setSoundNotifications] = useState(() => {
    return localStorage.getItem('ai-sound-notifications') === 'true';
  });
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  type SpeechRecognition = typeof window extends { webkitSpeechRecognition: infer T } ? T : any;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const messages = useMemo(() => currentSession?.messages || [], [currentSession]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    return messages.filter((message) =>
      message.content.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [messages, searchQuery]);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }
  };

  // Auto-scroll when messages change or when streaming
  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      // Small delay to ensure DOM has updated
      const timeoutId = setTimeout(() => scrollToBottom(), 50);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, autoScroll]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (autoScroll && isLoading) {
      const intervalId = setInterval(() => scrollToBottom(false), 100);
      return () => clearInterval(intervalId);
    }
  }, [isLoading, autoScroll]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Scroll button visibility
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      // Hide scroll button if auto-scroll is on and we're at bottom, or if we're near bottom
      setShowScrollButton(!isNearBottom && !(autoScroll && isNearBottom));
    };

    handleScroll(); // Initial check
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [autoScroll]);

  // Initialize session if needed
  useEffect(() => {
    if (!currentSession && isOpen && hasAcceptedTerms) {
      createNewSession();
    }
  }, [currentSession, isOpen, hasAcceptedTerms, createNewSession]);

  const playNotificationSound = React.useCallback(() => {
    if (soundNotifications) {
      try {
        // Create a more pleasant notification beep
        const AudioCtx: typeof AudioContext =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
        const audioContext = new AudioCtx();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);

        oscillator.onended = () => {
          audioContext.close();
        };
      } catch (e) {
        console.error('Failed to play sound:', e);
      }
    }
  }, [soundNotifications]);

  // Play sound when AI responds
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && !lastMessage.isStreaming) {
        playNotificationSound();
      }
    }
  }, [messages, playNotificationSound]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const messageToSend = input.trim();
    setInput('');

    try {
      await sendMessage(messageToSend);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Initialize speech recognition and synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('');
          setInput(transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert(
        'Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.',
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  };

  const speakMessage = (text: string) => {
    if (!synthRef.current) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setAiSpeaking(true);
    utterance.onend = () => setAiSpeaking(false);
    utterance.onerror = () => setAiSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setAiSpeaking(false);
    }
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
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const toggleLike = (messageId: string) => {
    setLikedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
        dislikedMessages.delete(messageId);
      }
      return newSet;
    });
    setDislikedMessages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  };

  const toggleDislike = (messageId: string) => {
    setDislikedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
        likedMessages.delete(messageId);
      }
      return newSet;
    });
    setLikedMessages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  };

  const exportChat = () => {
    const chatText = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const acceptTerms = () => {
    setHasAcceptedTerms(true);
    setShowTermsModal(false);
    localStorage.setItem('ai-terms-accepted', 'true');
    createNewSession();
  };

  const declineTerms = () => {
    setShowTermsModal(false);
    onClose();
  };

  useEffect(() => {
    if (isOpen && !hasAcceptedTerms) {
      setTimeout(() => setShowTermsModal(true), 300);
    }
  }, [isOpen, hasAcceptedTerms]);

  const clearChat = () => {
    clearCurrentSession();
  };

  // Resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const constrainedWidth = Math.max(300, Math.min(800, newWidth));
      setSidebarWidth(constrainedWidth);
    },
    [isResizing],
  );

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
  }, [isResizing, handleMouseMove]);

  // Render markdown safely
  const renderMarkdown = (content: string) => {
    const processedContent = content.replace(/undefined/g, 'link');
    const rawHTML = marked(processedContent) as string;
    const cleanHTML = DOMPurify.sanitize(rawHTML, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'code',
        'pre',
        'a',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'title'],
    });
    return { __html: cleanHTML };
  };

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
                          The AI may provide inaccurate information, so please verify important
                          details.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Privacy Policy</h3>
                        <p>
                          Your conversations may be used to improve our AI services. We collect
                          usage data and feedback to enhance the experience. Personal information is
                          handled according to our main privacy policy.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Data Usage</h3>
                        <p>
                          Messages are processed by our AI systems. We may retain conversations for
                          quality improvement and support purposes.
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

          {/* Settings Modal */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-0 z-60 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-foreground">Settings</h2>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowSettings(false)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5 text-muted-foreground" />
                      </motion.button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Auto-scroll</span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const newValue = !autoScroll;
                            setAutoScroll(newValue);
                            localStorage.setItem('ai-auto-scroll', String(newValue));
                          }}
                          className={`w-10 h-6 rounded-full relative transition-colors ${autoScroll ? 'bg-[#DDEF00]' : 'bg-muted'
                            }`}
                        >
                          <motion.div
                            className="w-4 h-4 bg-white rounded-full absolute top-1 shadow-md"
                            animate={{ left: autoScroll ? '20px' : '4px' }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        </motion.button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          Sound notifications
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const newValue = !soundNotifications;
                            setSoundNotifications(newValue);
                            localStorage.setItem('ai-sound-notifications', String(newValue));
                          }}
                          className={`w-10 h-6 rounded-full relative transition-colors ${soundNotifications ? 'bg-[#DDEF00]' : 'bg-muted'
                            }`}
                        >
                          <motion.div
                            className="w-4 h-4 bg-white rounded-full absolute top-1 shadow-md"
                            animate={{ left: soundNotifications ? '20px' : '4px' }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        </motion.button>
                      </div>
                    </div>

                    {/* AI Button Position */}
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Button Position</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'top-left', label: 'Top Left' },
                          { value: 'top-right', label: 'Top Right' },
                          { value: 'bottom-left', label: 'Bottom Left' },
                          { value: 'bottom-right', label: 'Bottom Right' },
                        ].map((option) => (
                          <motion.button
                            key={option.value}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setAIButtonPosition(option.value as AIButtonPosition)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${aiButtonPosition === option.value
                              ? 'bg-[#DDEF00] text-black'
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                              }`}
                          >
                            {option.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Hide for Session */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Hide for this session</span>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setAiButtonHidden(!aiButtonHidden)}
                        className={`w-10 h-6 rounded-full relative transition-colors ${aiButtonHidden ? 'bg-red-500' : 'bg-muted'
                          }`}
                      >
                        <motion.div
                          className="w-4 h-4 bg-white rounded-full absolute top-1 shadow-md"
                          animate={{ left: aiButtonHidden ? '20px' : '4px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </motion.button>
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
            className="fixed right-0 top-0 h-full max-w-screen w-full sm:max-w-[90vw] md:max-w-[600px] lg:max-w-none bg-background border-l border-border shadow-2xl z-50 flex flex-col"
            style={{
              width: window.innerWidth < 1024 ? '100%' : `${sidebarWidth}px`,
              maxWidth:
                window.innerWidth < 640
                  ? '100vw'
                  : window.innerWidth < 768
                    ? '90vw'
                    : window.innerWidth < 1024
                      ? '600px'
                      : '800px',
            }}
          >
            {/* Resize Handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 bg-border hover:bg-[#DDEF00]/50 cursor-col-resize transition-colors z-10 hidden lg:block"
              onMouseDown={handleMouseDown}
            />

            {/* Header */}
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-r from-[#DDEF00]/5 via-[#DDEF00]/10 to-transparent" />
              <div className="relative p-3 sm:p-4 border-b border-border backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="relative w-10 h-10 rounded-xl bg-linear-to-br from-[#DDEF00] to-[#DDEF00]/70 flex items-center justify-center shadow-lg"
                      whileHover={{ scale: 1.05, rotate: 5 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <Sparkles className="w-5 h-5 text-black" />
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-[#DDEF00]/20"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </motion.div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        AI Assistant
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {messages.length > 0 && (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowSearch(!showSearch)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Search messages"
                        >
                          <Search className="w-4 h-4 text-muted-foreground" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={exportChat}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Export chat"
                        >
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={clearChat}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Clear chat"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </motion.button>
                      </>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowSettings(true)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onClose}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </motion.button>
                  </div>
                </div>
                {showSearch && messages.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#DDEF00] focus:border-transparent text-sm"
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 text-red-600 text-sm flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <strong>Error:</strong> {error}
              </motion.div>
            )}

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 space-y-4 min-w-0 relative scroll-smooth"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 space-y-6">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative"
                  >
                    <motion.div
                      className="w-24 h-24 rounded-full bg-linear-to-br from-[#DDEF00] to-[#DDEF00]/60 flex items-center justify-center shadow-2xl"
                      animate={{
                        boxShadow: [
                          '0 20px 60px rgba(221, 239, 0, 0.3)',
                          '0 20px 80px rgba(221, 239, 0, 0.5)',
                          '0 20px 60px rgba(221, 239, 0, 0.3)',
                        ],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className="w-12 h-12 text-black" />
                    </motion.div>
                    <motion.div
                      className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-background flex items-center justify-center"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Zap className="w-3 h-3 text-white" />
                    </motion.div>
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2 bg-linear-to-r from-foreground to-foreground/60 bg-clip-text">
                      {hasAcceptedTerms ? 'How can I help you today?' : 'Welcome to AI Assistant'}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      {hasAcceptedTerms
                        ? 'Ask me anything about FairArena, get help, or explore features'
                        : 'Please review and accept our terms to get started'}
                    </p>
                  </div>
                  {hasAcceptedTerms && (
                    <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
                      {[
                        { icon: MessageSquare, text: 'How do I get started?' },
                        { icon: User, text: 'Search for profiles' },
                        { icon: Zap, text: 'Show platform statistics' },
                        { icon: Bot, text: 'Find organizations' },
                      ].map((suggestion, index) => (
                        <motion.button
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setInput(suggestion.text)}
                          className="group p-4 text-sm text-left rounded-xl border border-border hover:border-[#DDEF00]/50 hover:bg-[#DDEF00]/5 transition-all flex items-center gap-3 bg-background/50"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#DDEF00]/10 flex items-center justify-center group-hover:bg-[#DDEF00]/20 transition-colors">
                            {React.createElement(suggestion.icon, {
                              className: 'w-4 h-4 text-[#DDEF00]',
                            })}
                          </div>
                          <span className="flex-1">{suggestion.text}</span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {filteredMessages.length === 0 && searchQuery ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                      <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        No messages found
                      </h3>
                      <p className="text-sm text-muted-foreground">Try a different search term</p>
                    </div>
                  ) : (
                    filteredMessages.map((message, idx) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} gap-3 px-2 group`}
                      >
                        {message.role === 'assistant' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-8 h-8 rounded-lg bg-linear-to-br from-[#DDEF00] to-[#DDEF00]/70 flex items-center justify-center shrink-0 shadow-md"
                          >
                            <Bot className="w-4 h-4 text-black" />
                          </motion.div>
                        )}
                        <div className="flex flex-col gap-2 max-w-[85%]">
                          <div
                            className={`rounded-2xl p-4 ${message.role === 'user' ? 'bg-linear-to-br from-[#DDEF00] to-[#DDEF00]/90 text-black shadow-lg' : 'bg-muted/50 text-foreground border border-border/50 backdrop-blur-sm'}`}
                          >
                            {message.role === 'assistant' ? (
                              <div
                                className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
                                dangerouslySetInnerHTML={renderMarkdown(message.content)}
                              />
                            ) : (
                              <div className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
                                {message.content}
                              </div>
                            )}
                            {message.isStreaming && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-2 mt-2 pt-2 border-t border-current/10"
                              >
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span className="text-xs opacity-60">Thinking...</span>
                              </motion.div>
                            )}
                          </div>
                          {!message.isStreaming && (
                            <div className="flex items-center justify-between gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs text-muted-foreground">
                                {message.timestamp.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {message.role === 'assistant' && (
                                <div className="flex items-center gap-1">
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => toggleLike(message.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${likedMessages.has(message.id) ? 'bg-green-500/20 text-green-600' : 'hover:bg-muted'}`}
                                    title="Like"
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => toggleDislike(message.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${dislikedMessages.has(message.id) ? 'bg-red-500/20 text-red-600' : 'hover:bg-muted'}`}
                                    title="Dislike"
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => copyMessage(message.content, message.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${copiedMessageId === message.id ? 'bg-green-500/20 text-green-600' : 'hover:bg-muted'}`}
                                    title={copiedMessageId === message.id ? 'Copied!' : 'Copy'}
                                  >
                                    {copiedMessageId === message.id ? (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-3.5 h-3.5 flex items-center justify-center font-bold"
                                      >
                                        ✓
                                      </motion.div>
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                      if (aiSpeaking) {
                                        stopSpeaking();
                                      } else {
                                        speakMessage(message.content);
                                      }
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors ${aiSpeaking
                                      ? 'bg-[#DDEF00]/20 text-[#DDEF00]'
                                      : 'hover:bg-muted'
                                      }`}
                                    title={aiSpeaking ? 'Stop speaking' : 'Read aloud'}
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                      />
                                    </svg>
                                  </motion.button>
                                  {idx === messages.length - 1 && (
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => regenerateLastMessage()}
                                      disabled={isLoading}
                                      className="p-1.5 rounded-lg transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Regenerate"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </motion.button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <img
                            src={user?.profileImageUrl || `https://ui-avatars.com/api/?name=${user?.firstName || 'User'}`}
                            alt="User avatar"
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        )}
                      </motion.div>
                    ))
                  )}

                  <div ref={messagesEndRef} />
                  {showScrollButton && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onClick={() => scrollToBottom()}
                      className="sticky bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[#DDEF00] hover:bg-[#DDEF00]/90 shadow-lg flex items-center justify-center z-10"
                    >
                      <svg
                        className="w-5 h-5 text-black"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </motion.button>
                  )}
                </>
              )}
            </div>

            {/* Input */}
            <div className="relative">
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />
              <div className="p-3 sm:p-4 bg-linear-to-t from-background via-background to-background/50 backdrop-blur-sm">
                {hasAcceptedTerms ? (
                  <div className="space-y-3">
                    <div className="flex items-end gap-2 w-full">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleVoiceInput}
                        className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all shrink-0 ${isListening
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                        title={isListening ? 'Stop recording' : 'Voice input'}
                      >
                        <Mic className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
                      </motion.button>
                      <div className="flex-1 relative">
                        <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Type your message..."
                          rows={1}
                          disabled={isLoading}
                          className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#DDEF00] focus:border-transparent resize-none text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all placeholder:text-muted-foreground/50"
                          style={{ minHeight: '44px', maxHeight: '120px' }}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={isLoading ? stopMessage : handleSend}
                        disabled={!input.trim() && !isLoading}
                        className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-linear-to-br from-[#DDEF00] to-[#DDEF00]/80 hover:from-[#DDEF00]/90 hover:to-[#DDEF00]/70 text-black font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none shrink-0 overflow-hidden"
                        aria-label={isLoading ? 'Stop' : 'Send'}
                      >
                        <motion.div
                          className="absolute inset-0 bg-white/20"
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 0, 0.5],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        {isLoading ? (
                          <X className="w-5 h-5 relative z-10" />
                        ) : (
                          <Send className="w-5 h-5 relative z-10" />
                        )}
                      </motion.button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        AI can make mistakes
                      </span>
                      <span className="opacity-60">Press Enter to send</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-linear-to-br from-[#DDEF00]/20 to-[#DDEF00]/10 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-[#DDEF00]" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Please accept the terms to start chatting with AI
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowTermsModal(true)}
                      className="px-6 py-2.5 rounded-xl bg-linear-to-r from-[#DDEF00] to-[#DDEF00]/90 hover:from-[#DDEF00]/90 hover:to-[#DDEF00]/80 text-black font-medium transition-all text-sm shadow-lg"
                    >
                      Review Terms
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
