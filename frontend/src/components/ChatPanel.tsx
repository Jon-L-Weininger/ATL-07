import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  X,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ReactMarkdown Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-2 text-xs text-red-700 bg-red-50 dark:bg-red-950/50 dark:text-red-400 rounded border border-red-200 dark:border-red-800/50">
          Failed to render markdown content:{' '}
          {this.state.error?.message || 'Unknown error'}
        </div>
      );
    }
    return this.props.children;
  }
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  thoughts?: string;
  suggestions?: string[];
  isStreaming?: boolean;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activePostingId: number;
  activeProductLabel: string;
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
}

const COORDINATOR_STARTER_QUESTIONS = [
  'Why them and not Greenline Community Pantry?',
  'Compare Cedar Street vs. Maple Street tie-breaker',
  "What's the clock on this posting?",
  "They said no — who's next in line?",
  'Write the outreach message for this match',
  "Did our matches go where Atlanta's need is?",
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  activePostingId,
  activeProductLabel,
  externalPrompt,
  onClearExternalPrompt,
}) => {
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      content:
        "Ready to help with your dispatch queue. Ask me why a recipient was chosen, why a near-miss decoy was blocked, how much time is left on the clock, or how to route if the primary recipient declines.",
      suggestions: COORDINATOR_STARTER_QUESTIONS.slice(0, 4),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (externalPrompt && isOpen && !isLoading) {
      handleSend(null, externalPrompt);
      if (onClearExternalPrompt) {
        onClearExternalPrompt();
      }
    }
  }, [externalPrompt, isOpen]);

  const handleSend = async (
    e: React.FormEvent | null,
    overrideText?: string,
  ) => {
    if (e) e.preventDefault();
    const textToSend = overrideText !== undefined ? overrideText : input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg = textToSend.trim();
    if (overrideText === undefined) {
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    const updatedHistory: ChatTurn[] = [
      ...messages,
      { role: 'user', content: userMsg },
    ];
    setMessages(updatedHistory);
    setIsLoading(true);

    try {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          thoughts: '',
          suggestions: [],
          isStreaming: true,
        },
      ]);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          active_posting_id: activePostingId,
          track: 'RETAIL',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response from Coordinator Agent');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported');
      }

      const decoder = new TextDecoder();
      let assistantThoughts = '';
      let assistantContent = '';
      let assistantSuggestions: string[] = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.type === 'THOUGHT') {
                assistantThoughts += data.content;
              } else if (data.type === 'SUGGESTION') {
                assistantSuggestions = [...assistantSuggestions, data.content];
              } else {
                assistantContent += data.content;
              }

              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                next[lastIdx] = {
                  ...next[lastIdx],
                  content: assistantContent,
                  thoughts: assistantThoughts,
                  suggestions: assistantSuggestions.filter(
                    (s) => !s.toLowerCase().includes('non-food') && !s.toLowerCase().includes('essential'),
                  ),
                };
                return next;
              });
            } catch (err) {
              console.error('Error parsing SSE JSON:', err, dataStr);
            }
          }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        next[lastIdx] = {
          ...next[lastIdx],
          isStreaming: false,
        };
        return next;
      });
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        next[lastIdx] = {
          role: 'assistant',
          content:
            'Unable to reach the Coordinator Agent service right now. Please check that the backend server is running on port 8000.',
          isStreaming: false,
        };
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Subtle backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <aside className="relative z-10 w-full max-w-md bg-white dark:bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-display font-semibold text-slate-900 dark:text-slate-100">
                  Dispatch Assistant
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Offer #{activePostingId}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[250px]">
                Active load: {activeProductLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setMessages([
                  {
                    role: 'assistant',
                    content:
                      'Conversation cleared. Ask me about the current offer, why near-miss decoys were blocked, or who is next in line.',
                    suggestions: COORDINATOR_STARTER_QUESTIONS.slice(0, 4),
                  },
                ])
              }
              title="Reset conversation"
              className="p-2 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close assistant"
              className="p-2 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Question Pills */}
        <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center gap-1.5 overflow-x-auto">
          <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {COORDINATOR_STARTER_QUESTIONS.map((q, i) => (
            <button
              key={i}
              disabled={isLoading}
              onClick={() => handleSend(null, q)}
              className="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 dark:bg-[#0B0F17]/50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-2.5 ${
                msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white dark:bg-emerald-600'
                    : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex flex-col space-y-2 max-w-[86%]">
                {msg.thoughts && (
                  <details
                    className="text-xs bg-slate-100 dark:bg-slate-800/70 rounded-xl p-2.5 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer transition-all"
                    open={msg.isStreaming && !msg.content}
                  >
                    <summary
                      className={`font-medium text-slate-700 dark:text-slate-300 select-none outline-none truncate max-w-xs ${
                        msg.isStreaming && !msg.content ? 'animate-pulse' : ''
                      }`}
                    >
                      {(() => {
                        if (!msg.isStreaming || msg.content) {
                          return 'View verification steps';
                        }
                        const lines = msg.thoughts
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean);
                        if (lines.length === 0) return 'Checking constraints...';
                        const lastLine = lines[lines.length - 1]
                          .replace(/^\*\*|\*\*$/g, '')
                          .replace(/^#+\s*/, '');
                        return lastLine || 'Checking constraints...';
                      })()}
                    </summary>
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 prose prose-xs dark:prose-invert max-w-none leading-relaxed break-words opacity-90 font-mono text-[11px]">
                      <ErrorBoundary>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.thoughts}
                        </ReactMarkdown>
                      </ErrorBoundary>
                    </div>
                  </details>
                )}

                {(msg.content || msg.role === 'user') && (
                  <div
                    className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white dark:bg-emerald-600 rounded-tr-sm whitespace-pre-wrap shadow-sm'
                        : 'bg-white text-slate-800 dark:bg-slate-800/90 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/70 rounded-tl-sm shadow-sm prose prose-sm dark:prose-invert max-w-none break-words'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <ErrorBoundary>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </ErrorBoundary>
                    )}
                  </div>
                )}

                {msg.suggestions &&
                  msg.suggestions.length > 0 &&
                  !msg.isStreaming && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.suggestions.map((suggestion, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => handleSend(null, suggestion)}
                          disabled={isLoading}
                          className="text-left text-xs bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          ))}

          {isLoading &&
            (!messages.length ||
              (!messages[messages.length - 1].content &&
                !messages[messages.length - 1].thoughts)) && (
              <div className="flex items-start space-x-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="p-3 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Checking recipient profiles...</span>
                </div>
              </div>
            )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={(e) => handleSend(e)}
          className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <div className="relative flex items-end">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Ask about this match, clock margin, or backups..."
              disabled={isLoading}
              className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600 disabled:opacity-50 transition-all resize-none overflow-y-auto max-h-32"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="absolute right-2 bottom-2 p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
};
