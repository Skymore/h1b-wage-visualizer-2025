'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Loader2, Sparkles, MapPin, Search, DollarSign, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getOrCreateVisitorId } from '@/lib/visitor.client';

type ChatMessage = UIMessage;
type MessagePart = ChatMessage['parts'][number];

type ToolInvocationDetails = {
    toolInvocation?: {
        toolName?: string;
        args?: unknown;
        input?: unknown;
        arguments?: unknown;
        state?: string;
        result?: unknown;
    };
    args?: unknown;
    input?: unknown;
    arguments?: unknown;
    state?: string;
    result?: unknown;
    output?: unknown;
    response?: unknown;
};

type ToolPartData = MessagePart & ToolInvocationDetails;

const isToolMessagePart = (part: MessagePart): part is ToolPartData => {
    if (typeof part.type !== 'string') return false;
    return part.type.startsWith('tool-') || part.type === 'dynamic-tool';
};

const extractPrimitiveValues = (value: unknown): Array<string | number> => {
    if (Array.isArray(value)) {
        return value.flatMap((item) => extractPrimitiveValues(item));
    }
    if (typeof value === 'object' && value !== null) {
        return Object.values(value).flatMap((item) => extractPrimitiveValues(item));
    }
    if (typeof value === 'string' || typeof value === 'number') {
        return [value];
    }
    return [];
};

const summarizeArgs = (value: unknown): string => {
    if (!value) return '';
    const flattened = extractPrimitiveValues(value);
    if (flattened.length === 0) return '';
    const joined = flattened.join(', ');
    return joined.length > 20 ? `(${joined.substring(0, 18)}...)` : `(${joined})`;
};

const isStoredMessagesArray = (value: unknown): value is ChatMessage[] => {
    if (!Array.isArray(value)) return false;
    return value.every((item) => {
        if (typeof item !== 'object' || item === null) return false;
        const potential = item as Partial<ChatMessage>;
        return typeof potential.id === 'string'
            && (potential.role === 'user' || potential.role === 'assistant' || potential.role === 'system')
            && Array.isArray(potential.parts);
    });
};

// Separate component for tool parts
const ToolPart = ({ part, index }: { part: ToolPartData; index: number }) => {
    const t = useTranslations('ChatWidget');
    const [isExpanded, setIsExpanded] = useState(false);

    // Safety extraction
    const toolInvocation = part.toolInvocation;
    const name = toolInvocation?.toolName || (typeof part.type === 'string' ? part.type.replace('tool-', '') : 'Tool');
    // Try args (standard), input (some providers), or arguments (raw)
    const args = toolInvocation?.args ?? toolInvocation?.input ?? toolInvocation?.arguments ?? part.args ?? part.input ?? part.arguments ?? null;
    const hasOutput = part.state === 'output-available' || toolInvocation?.state === 'result';

    // Try to find result
    const result = part.result || part.output || part.response || toolInvocation?.result || null;

    // Always allowed to expand if done
    const canExpand = hasOutput;

    // Icon
    let Icon = Sparkles;
    if (name.toLowerCase().includes('wage')) Icon = DollarSign;
    if (name.toLowerCase().includes('area')) Icon = MapPin;
    if (name.toLowerCase().includes('occupation')) Icon = Search;

    // Format args for summary
    const argsSummary = summarizeArgs(args);

    if (!hasOutput) {
        return (
            <div key={index} className="flex items-center gap-2 text-xs p-2 my-1 rounded bg-muted/50 border border-muted text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{t('using_tool', { tool: name })} {argsSummary}</span>
            </div>
        );
    }

    return (
        <div key={index} className="flex flex-col gap-1 my-1">
            <button
                onClick={() => canExpand && setIsExpanded(!isExpanded)}
                className={`flex items-center justify-between gap-2 text-xs p-2 rounded border transition-colors w-full text-left cursor-pointer
                    ${canExpand
                        ? 'bg-green-50/50 border-green-100 text-green-700 hover:bg-green-100/50 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                        : 'bg-gray-50 border-gray-200 text-gray-500'}`}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <Icon className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{t('found_data', { tool: name })} {argsSummary}</span>
                </div>
                {canExpand && (
                    <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                )}
            </button>

            {/* Expanded Details */}
            {isExpanded && canExpand && (
                <div className="ml-2 p-2 text-[10px] bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 overflow-x-auto">
                    {args && (
                        <div className="mb-2">
                            <div className="font-semibold text-gray-500 mb-0.5">{t('arguments')}</div>
                            <pre className="font-mono whitespace-pre-wrap text-gray-600 dark:text-gray-400">{JSON.stringify(args, null, 2)}</pre>
                        </div>
                    )}
                    <div>
                        <div className="font-semibold text-gray-500 mb-0.5">{t('result')}</div>
                        <pre className="font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                            {result ? JSON.stringify(result, null, 2) : '(Empty Result)'}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export function ChatWidget() {
    const t = useTranslations('ChatWidget');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState('');
    const [isOpen, setIsOpen] = useState(false); // Default closed
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
    const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
    const [visitorId, setVisitorId] = useState<string | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('h1b-chat-messages');
        if (stored) {
            const frameId = requestAnimationFrame(() => {
                try {
                    const parsed = JSON.parse(stored);
                    if (isStoredMessagesArray(parsed)) {
                        setInitialMessages(parsed);
                    } else {
                        localStorage.removeItem('h1b-chat-messages');
                    }
                } catch (error) {
                    console.error('Failed to parse stored messages:', error);
                    localStorage.removeItem('h1b-chat-messages');
                }
            });
            return () => cancelAnimationFrame(frameId);
        }
    }, []);

    useEffect(() => {
        const id = getOrCreateVisitorId();
        if (!id) return;
        const frameId = requestAnimationFrame(() => setVisitorId(id));
        return () => cancelAnimationFrame(frameId);
    }, []);

    const { messages, sendMessage, status, setMessages } = useChat<ChatMessage>();

    // Initialize messages from localStorage
    useEffect(() => {
        if (initialMessages.length > 0 && messages.length === 0) {
            setMessages(initialMessages);
        }
    }, [initialMessages, messages.length, setMessages]);

    // Save to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('h1b-chat-messages', JSON.stringify(messages));
        }
    }, [messages]);

    const isLoading = status === 'submitted' || status === 'streaming';

    const logChatMessage = (count = 1) => {
        if (!visitorId) return;
        fetch('/api/metrics/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ count, visitorId })
        }).catch((error) => console.error('Failed to record chat metric', error));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        await sendMessage({ text: input });
        logChatMessage(1);
        setInput('');
    };

    const handleClearChat = () => {
        setIsClearDialogOpen(true);
    };

    const confirmClearChat = () => {
        localStorage.removeItem('h1b-chat-messages');
        setMessages([]);
        setInitialMessages([]);
        setIsClearDialogOpen(false);
    };

    // Auto-scroll
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            // Lock body scroll
            document.body.style.overflow = 'hidden';
        } else {
            // Unlock body scroll
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [messages, status, isOpen]);

    return (
        <>
            {/* Clear Confirmation Dialog */}
            <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('clear')}</DialogTitle>
                        <DialogDescription>
                            {t('confirmClear')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsClearDialogOpen(false)}>
                            {t('cancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmClearChat}>
                            {t('clear')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Toggle Button (Visible when closed) */}
            {!isOpen && (
                <Button
                    id="chat-widget-trigger"
                    onClick={() => setIsOpen(true)}
                    className="fixed right-6 bottom-6 rounded-full w-14 h-14 shadow-lg z-50 flex items-center justify-center transition-transform hover:scale-105"
                >
                    <Bot className="w-8 h-8" />
                </Button>
            )}

            {/* Chat Sidebar (Overlay) */}
            <div
                className={`fixed top-0 right-0 h-[100dvh] w-full md:w-[500px] lg:w-[600px] bg-white dark:bg-gray-950 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200 dark:border-gray-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsOpen(false)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            <h2 className="font-semibold text-lg">{t('header_title')}</h2>
                        </div>
                    </div>
                    <Button
                        onClick={handleClearChat}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t('clear') || 'Clear'}
                    </Button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-950">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                            <div className="bg-muted p-4 rounded-full mb-4">
                                <Bot className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="font-medium text-foreground mb-1">{t('hi_there')}</h3>
                            <p className="text-sm max-w-xs">{t('welcome')}</p>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                                {/* Bot Avatar */}
                                {message.role !== 'user' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center mt-1">
                                        <Bot className="w-5 h-5 text-primary" />
                                    </div>
                                )}

                                {/* Message Content */}
                                <div className={`flex flex-col max-w-[85%] space-y-1 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${message.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                                        : 'bg-muted border border-border rounded-tl-none'
                                        }`}>
                                        {message.parts ? message.parts.map((part, idx) => {
                                            if (part.type === 'text') {
                                                return (
                                                    <div key={idx} className={`prose prose-sm max-w-none ${message.role === 'user' ? 'text-white prose-invert' : 'dark:prose-invert'}`}>
                                                        <ReactMarkdown>{part.text}</ReactMarkdown>
                                                    </div>
                                                );
                                            }
                                            if (isToolMessagePart(part)) {
                                                return <ToolPart part={part} index={idx} key={idx} />;
                                            }
                                            return null;
                                        }) : (
                                            <div className="text-red-500 text-xs">Error: Message format incompatible</div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground opacity-70 px-1">
                                        {message.role === 'user' ? t('you') : t('assistant')}
                                    </span>
                                </div>

                                {/* User Avatar */}
                                {message.role === 'user' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mt-1">
                                        <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {/* Loading Indicator */}
                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="bg-muted border border-border rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">{t('thinking')}</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                    <form onSubmit={handleFormSubmit} className="flex gap-2 items-center bg-muted/50 border border-input rounded-full px-2 py-1 focus-within:ring-2 focus-within:ring-ring ring-offset-2 ring-offset-background transition-all">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={t('placeholder') || 'Ask about H1B wages...'}
                            disabled={isLoading}
                            className="flex-1 border-none bg-transparent focus-visible:ring-0 shadow-none px-3"
                        />
                        <Button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            size="icon"
                            className={`rounded-full h-8 w-8 m-1 transition-all ${input.trim() ? '' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                    <div className="text-[10px] text-center text-muted-foreground mt-2 opacity-60">
                        {t('disclaimer')}
                    </div>
                </div>
            </div>
        </>
    );
}
