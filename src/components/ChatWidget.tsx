'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '@ai-sdk/react';
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

// Separate component for tool parts
const ToolPart = ({ part, index }: { part: any; index: number }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const toolName = part.type.replace('tool-', '');
    const hasOutput = part.state === 'output-available';

    // Try to find result in different fields
    const result = part.result || part.output || part.response || null;
    const hasResult = result !== null && hasOutput;

    // Icon selection
    let Icon = Sparkles;
    if (toolName.toLowerCase().includes('wage')) Icon = DollarSign;
    if (toolName.toLowerCase().includes('area')) Icon = MapPin;
    if (toolName.toLowerCase().includes('occupation')) Icon = Search;

    if (!hasOutput) {
        // Still loading
        return (
            <div key={index} className="flex items-center gap-2 text-xs p-2 my-1 rounded bg-blue-50/50 border border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Using {toolName}...</span>
            </div>
        );
    }

    // Completed with expandable result
    return (
        <div key={index} className="flex flex-col gap-1 my-1">
            <button
                onClick={() => hasResult && setIsExpanded(!isExpanded)}
                className={`flex items-center justify-between gap-2 text-xs p-2 rounded border transition-colors w-full text-left ${hasResult
                    ? 'bg-green-50/50 border-green-100 text-green-700 hover:bg-green-100/50 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/30 cursor-pointer'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                    }`}
            >
                <div className="flex items-center gap-2">
                    <Icon className="w-3 h-3" />
                    <span>Found data from {toolName}</span>
                </div>
                {hasResult && (
                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                )}
            </button>

            {/* Expandable JSON Result */}
            {isExpanded && hasResult && (
                <div className="ml-2 p-2 text-[10px] bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 overflow-x-auto">
                    <pre className="font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                        {JSON.stringify(result, null, 2)}
                    </pre>
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
    const [initialMessages, setInitialMessages] = useState<any[]>([]);

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('h1b-chat-messages');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.length > 0) {
                    setInitialMessages(parsed);
                }
            } catch (e) {
                console.error('Failed to parse stored messages:', e);
            }
        }
    }, []);

    const { messages, sendMessage, status, setMessages } = useChat();

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

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        await sendMessage({ text: input });
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
        }
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
                            Cancel
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
                    onClick={() => setIsOpen(true)}
                    className="fixed right-6 bottom-6 rounded-full w-14 h-14 shadow-lg z-50 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-transform hover:scale-105"
                >
                    <Bot className="w-8 h-8" />
                </Button>
            )}

            {/* Chat Sidebar (Overlay) */}
            <div
                className={`fixed top-0 right-0 h-screen w-full md:w-[500px] lg:w-[600px] bg-white dark:bg-gray-950 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200 dark:border-gray-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'
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
                            <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <h2 className="font-semibold text-lg">H1B Assistant</h2>
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
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4">
                                <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="font-medium text-foreground mb-1">Hi there!</h3>
                            <p className="text-sm max-w-xs">{t('welcome') || 'Ask me about H1B wages!'}</p>
                        </div>
                    ) : (
                        messages.map((m: any) => (
                            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                                {/* Bot Avatar */}
                                {m.role !== 'user' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mt-1">
                                        <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                )}

                                {/* Message Content */}
                                <div className={`flex flex-col max-w-[85%] space-y-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${m.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : 'bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-tl-none'
                                        }`}>
                                        {m.parts ? m.parts.map((part: any, idx: number) => {
                                            if (part.type === 'text') {
                                                return (
                                                    <div key={idx} className={`prose prose-sm max-w-none ${m.role === 'user' ? 'text-white prose-invert' : 'dark:prose-invert'}`}>
                                                        <ReactMarkdown>{part.text}</ReactMarkdown>
                                                    </div>
                                                );
                                            }
                                            if (part.type.startsWith('tool-')) {
                                                return <ToolPart part={part} index={idx} key={idx} />;
                                            }
                                            return null;
                                        }) : (
                                            <div className="text-red-500 text-xs">Error: Message format incompatible</div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground opacity-70 px-1">
                                        {m.role === 'user' ? 'You' : 'Assistant'}
                                    </span>
                                </div>

                                {/* User Avatar */}
                                {m.role === 'user' && (
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
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <span className="text-xs text-muted-foreground">Thinking...</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                    <form onSubmit={handleFormSubmit} className="flex gap-2 items-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-full px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500 ring-offset-2 dark:ring-offset-gray-950 transition-all">
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
                            className={`rounded-full h-8 w-8 m-1 transition-all ${input.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 dark:bg-gray-800 hover:bg-gray-400 text-gray-500'}`}
                        >
                            <Send className="h-4 w-4 text-white" />
                        </Button>
                    </form>
                    <div className="text-[10px] text-center text-muted-foreground mt-2 opacity-60">
                        AI can make mistakes. Check important info.
                    </div>
                </div>
            </div>
        </>
    );
}
