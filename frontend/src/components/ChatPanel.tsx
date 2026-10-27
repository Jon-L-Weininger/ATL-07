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
        <div className="p-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400 rounded border border-red-200 dark:border-red-800/50">
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
  activeTrack: string;
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
  'How do we handle Critical Non-Food Essentials?',
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  activePostingId,
  activeProductLabel,
  activeTrack,
  externalPrompt,
  onClearExternalPrompt,
}) => {
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      content:
        "Hi Coordinator! I'm connected to the live **BigQuery dataset (`qwiklabs-gcp-04-e7160ff57547.a4i_food`)** (`118 real Atlanta IRS organizations + 9 planted teaching cases = 127 recipients`, `10 surplus postings`, `661 USDA FoodKeeper rows`, `165 Georgia census tracts`). Ask me any of the **7 Coordinator Questions** about the active offer, near-miss decoys, USDA FoodKeeper clocks, or our **Critical Non-Food Essentials** stretch track.",
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
          track: activeTrack,
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
                  suggestions: assistantSuggestions,
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
            'Sorry, I encountered an error communicating with the Coordinator Agent service. Please verify `agent/server.py` is running on port 8000.',
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
    <aside className="w-full lg:w-[430px] xl:w-[460px] shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col h-[760px] shadow-sm transition-all">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/60 rounded-t-xl">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Coordinator AI Broker Chat
              </h2>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Posting #{activePostingId}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[260px]">
              Context: {activeProductLabel} · ADK + Gemini SSE
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
                    "Conversation reset. Ask me any of the **7 Coordinator Questions** about the active Atlanta offer, near-miss decoys, or neighborhood equity.",
                  suggestions: COORDINATOR_STARTER_QUESTIONS.slice(0, 4),
                },
              ])
            }
            title="Reset conversation"
            className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close chat panel"
            className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Coordinator Question Bar */}
      <div className="px-3.5 py-2 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-950/40 flex items-center gap-1.5 overflow-x-auto">
        <MessageSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        {COORDINATOR_STARTER_QUESTIONS.map((q, i) => (
          <button
            key={i}
            disabled={isLoading}
            onClick={() => handleSend(null, q)}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-blue-600/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400'
              }`}
            >
              {msg.role === 'user' ? (
                <User className="w-3.5 h-3.5" />
              ) : (
                <Bot className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="flex flex-col space-y-2 max-w-[85%]">
              {msg.thoughts && (
                <details
                  className="text-xs bg-zinc-100 dark:bg-zinc-800/60 rounded-lg p-2.5 text-zinc-600 dark:text-zinc-400 border border-zinc-200/70 dark:border-zinc-700/60 cursor-pointer transition-all"
                  open={msg.isStreaming && !msg.content}
                >
                  <summary
                    className={`font-medium text-zinc-700 dark:text-zinc-300 select-none outline-none truncate max-w-xs sm:max-w-sm ${
                      msg.isStreaming && !msg.content ? 'animate-pulse' : ''
                    }`}
                  >
                    {(() => {
                      if (!msg.isStreaming || msg.content) {
                        return 'Agent Reasoning & Tool Trace (VECTOR_SEARCH + FoodKeeper)';
                      }
                      const lines = msg.thoughts
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean);
                      if (lines.length === 0) return 'Thinking...';
                      const lastLine = lines[lines.length - 1]
                        .replace(/^\*\*|\*\*$/g, '')
                        .replace(/^#+\s*/, '');
                      return lastLine || 'Thinking...';
                    })()}
                  </summary>
                  <div className="mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 prose prose-xs dark:prose-invert max-w-none leading-relaxed break-words opacity-90 font-mono text-[11px]">
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
                  className={`p-3 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-none whitespace-pre-wrap'
                      : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200 rounded-tl-none prose prose-sm dark:prose-invert max-w-none break-words'
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
                        className="text-left text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
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
              <div className="w-7 h-7 rounded-full bg-blue-600/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="p-3 rounded-xl rounded-tl-none bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Thinking...</span>
              </div>
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={(e) => handleSend(e)}
        className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 rounded-b-xl"
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
            placeholder="Ask why a decoy was rejected, check the clock, or draft outreach..."
            disabled={isLoading}
            className="w-full pl-3.5 pr-10 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 disabled:opacity-50 transition-all resize-none overflow-y-auto max-h-32"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="absolute right-2 bottom-2 p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
};
