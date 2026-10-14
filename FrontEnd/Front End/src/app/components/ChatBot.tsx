import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Mic, Volume2, Send, Waves, MicOff, PhoneOff, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sqlUsed?: string;
}

// ← Your Django backend URL
const API_BASE = 'http://localhost:8001/api';  

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceConversation, setIsVoiceConversation] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [conversationState, setConversationState] = useState<'idle' | 'listening' | 'ai-speaking'>('idle');
  const [liveTranscript, setLiveTranscript] = useState<Array<{ speaker: string; text: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // ── Real API call to Django backend ──────────────────────────────────────
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const question = inputText;
    setInputText('');
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });

      const data = await res.json();
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: res.ok ? (data.answer || 'No answer received.') : `⚠️ Error: ${data.error || res.statusText}`,
        sender: 'bot',
        timestamp: new Date(),
        sqlUsed: data.sql_used ?? undefined,
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `⚠️ Could not reach the backend.\n\nMake sure your Django server is running:\npython manage.py runserver\n\nAnd Ollama is running:\nollama serve`,
        sender: 'bot',
        timestamp: new Date(),
      }]);
    }

    setIsTyping(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoiceInput = () => {
    if (!isListening) {
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        setIsTranscribing(true);
        setTimeout(() => {
          setIsTranscribing(false);
          setInputText('How many ECUs are in the database?');
        }, 1500);
      }, 3000);
    } else {
      setIsListening(false);
    }
  };

  const toggleSpeech = () => {
    setIsSpeaking(!isSpeaking);
  };

  const startVoiceConversation = () => {
    setIsVoiceConversation(true);
    setConversationState('listening');
    setLiveTranscript([]);

    setTimeout(() => {
      setConversationState('ai-speaking');
      setLiveTranscript([{ speaker: 'You', text: 'Show me available test benches' }]);

      setTimeout(() => {
        setLiveTranscript(prev => [...prev, { speaker: 'Assistant AI', text: 'Retrieving test bench data...' }]);

        setTimeout(() => {
          setConversationState('listening');
        }, 2000);
      }, 1500);
    }, 2000);
  };

  const endVoiceConversation = () => {
    setIsVoiceConversation(false);
    setConversationState('idle');
    setLiveTranscript([]);
    setIsMuted(false);
  };

  return (
    <>
      {/* Floating Chat Bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 bg-gradient-to-br from-[#354D6F] to-[#1A365B] rounded-full shadow-lg hover:shadow-2xl transition-shadow flex items-center justify-center z-50 group"
            style={{
              width: '38px',
              height: '38px',
              boxShadow: '0 4px 16px rgba(26, 54, 91, 0.3)'
            }}
          >
            {/* Pulse animation ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-[#557486]"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <MessageCircle className="w-5 h-5 text-white relative z-10 group-hover:rotate-12 transition-transform" />
            {/* Notification dot */}
            <motion.div
              className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#936363] rounded-full border border-white"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 50, y: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 50, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 w-80 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            style={{
              height: '480px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)'
            }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#354D6F] to-[#1A365B] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-white/20 backdrop-blur-sm rounded text-[10px] font-bold text-white">AI</span>
                    <h3 className="text-white font-bold text-sm">Assistant</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-white/80 text-xs">Ask Me Anything</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#F5F0E8]">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl ${
                      message.sender === 'user'
                        ? 'bg-[#354D6F] text-white rounded-br-sm'
                        : 'bg-white text-[#354D6F] rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {message.sender === 'bot' ? (
                      <div className="text-xs leading-relaxed space-y-1">
                        {message.text.split('\n').map((line, i) => {
                          const boldLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                          if (line.startsWith('• ') || line.startsWith('- ')) {
                            return (
                              <div key={i} className="flex gap-1.5">
                                <span className="mt-0.5 text-[#557486] flex-shrink-0">•</span>
                                <span dangerouslySetInnerHTML={{ __html: boldLine.replace(/^[•\-]\s*/, '') }} />
                              </div>
                            );
                          }
                          return line.trim() ? (
                            <p key={i} dangerouslySetInnerHTML={{ __html: boldLine }} />
                          ) : <div key={i} className="h-1" />;
                        })}
                      </div>
                    ) : (
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.text}</p>
                    )}
                    {/* SQL used — expandable hint */}
                    {message.sqlUsed && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">🔍 SQL used</summary>
                        <pre className="text-[9px] mt-1 bg-gray-100 rounded p-1 overflow-x-auto text-gray-600">{message.sqlUsed}</pre>
                      </details>
                    )}
                    <span
                      className={`text-[10px] mt-0.5 block ${
                        message.sender === 'user' ? 'text-white/60' : 'text-gray-400'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white px-3 py-2 rounded-xl rounded-bl-sm shadow-sm">
                    <div className="flex items-center gap-1">
                      <motion.div className="w-1.5 h-1.5 bg-[#557486] rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                      <motion.div className="w-1.5 h-1.5 bg-[#557486] rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                      <motion.div className="w-1.5 h-1.5 bg-[#557486] rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 bg-white p-3">
              {/* Voice Conversation Mode */}
              {isVoiceConversation ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Radio className="w-4 h-4 text-[#557486]" />
                    <span className="text-sm font-bold text-[#354D6F]">Voice Conversation Active</span>
                  </div>

                  <div className="relative h-32 bg-gradient-to-br from-[#F5F0E8] to-[#E5E0D8] rounded-2xl flex items-center justify-center overflow-hidden">
                    <motion.div
                      className="absolute inset-0"
                      style={{
                        background: conversationState === 'ai-speaking'
                          ? 'radial-gradient(circle at center, rgba(85, 116, 134, 0.15), transparent)'
                          : 'radial-gradient(circle at center, rgba(147, 99, 99, 0.15), transparent)'
                      }}
                      animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <div className="relative z-10 flex items-center justify-center gap-1">
                      {[...Array(12)].map((_, i) => (
                        <motion.div
                          key={i}
                          className={`w-1 rounded-full ${conversationState === 'ai-speaking' ? 'bg-[#557486]' : 'bg-[#936363]'}`}
                          initial={{ height: 8 }}
                          animate={{ height: conversationState !== 'idle' ? [8, 40, 16, 32, 8] : 8 }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-medium text-[#354D6F]">
                      {conversationState === 'listening' && 'Listening...'}
                      {conversationState === 'ai-speaking' && 'Assistant AI is speaking...'}
                      {conversationState === 'idle' && 'Ready to listen'}
                    </p>
                  </div>

                  {liveTranscript.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-1 max-h-24 overflow-y-auto">
                      {liveTranscript.map((item, index) => (
                        <div key={index} className="text-xs">
                          <span className="font-bold text-[#354D6F]">{item.speaker}:</span>{' '}
                          <span className="text-gray-600">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsMuted(!isMuted)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${isMuted ? 'bg-gray-200 text-gray-600' : 'bg-[#F5F0E8] text-[#354D6F] hover:bg-[#E5E0D8]'}`}
                    >
                      {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      <span className="text-xs font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsSpeaking(!isSpeaking)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${isSpeaking ? 'bg-[#557486] text-white' : 'bg-[#F5F0E8] text-[#354D6F] hover:bg-[#E5E0D8]'}`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span className="text-xs font-medium">Speaker</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={endVoiceConversation}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#936363] text-white hover:bg-[#836363] transition-all"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span className="text-xs font-medium">End</span>
                    </motion.button>
                  </div>
                </div>
              ) : isListening || isTranscribing ? (
                /* Voice Recording UI (Dictation Mode) */
                <div className="space-y-3">
                  <div className="relative bg-gradient-to-r from-[#F5F0E8] to-[#E5E0D8] rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <motion.div
                          className="w-10 h-10 bg-[#936363] rounded-full flex items-center justify-center"
                          animate={{
                            boxShadow: isListening
                              ? ['0 0 0 0 rgba(147, 99, 99, 0.4)', '0 0 0 12px rgba(147, 99, 99, 0)', '0 0 0 0 rgba(147, 99, 99, 0)']
                              : 'none'
                          }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <Mic className="w-5 h-5 text-white" />
                        </motion.div>
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#354D6F] mb-1">
                          {isListening ? 'Listening...' : 'Transcribing...'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {isListening ? 'Speak now' : 'Converting speech to text...'}
                        </p>

                        {isListening && (
                          <div className="flex items-center gap-0.5 mt-2">
                            {[...Array(20)].map((_, i) => (
                              <motion.div
                                key={i}
                                className="w-0.5 bg-[#936363] rounded-full"
                                initial={{ height: 2 }}
                                animate={{ height: [2, 12, 4, 8, 2] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.05, ease: "easeInOut" }}
                              />
                            ))}
                          </div>
                        )}

                        {isTranscribing && (
                          <div className="flex items-center gap-1 mt-2">
                            {[...Array(3)].map((_, i) => (
                              <motion.div
                                key={i}
                                className="w-1.5 h-1.5 bg-[#557486] rounded-full"
                                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {isListening && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setIsListening(false)}
                          className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all"
                        >
                          <div className="w-3 h-3 bg-[#936363] rounded-sm" />
                        </motion.button>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 text-center">
                    {isListening ? 'Click stop to finish recording' : 'Please wait...'}
                  </p>
                </div>
              ) : (
                /* Normal Text Input */
                <>
                  <div className="relative">
                    <textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask anything about your database…"
                      rows={1}
                      className="w-full pl-3 pr-32 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:border-[#557486] focus:ring-2 focus:ring-[#557486]/20 resize-none text-xs bg-white transition-all shadow-sm"
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleVoiceInput}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-gray-100 text-gray-500"
                        title="Voice dictation"
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={startVoiceConversation}
                        className="w-8 h-8 flex items-center justify-center rounded-full transition-all shadow-sm bg-gray-100 text-gray-500 hover:bg-gray-200"
                        title="Voice conversation mode"
                      >
                        <Waves className="w-4 h-4" />
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSendMessage}
                        disabled={!inputText.trim() || isTyping}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br from-[#354D6F] to-[#1A365B] text-white hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Send message"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 mt-2 text-center">
                    Press Enter to send • Shift + Enter for new line
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}