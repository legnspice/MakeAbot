'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, MoreVertical, Send } from 'lucide-react';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';

type Person = { id: string; name: string };

type ChatMessage = {
  id: string;
  sender: 'you' | 'them';
  content: string;
  createdAt: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

export default function ChatPage() {
  const router = useRouter();
  const params = useSearchParams();

  const title = params.get('title') ?? 'ITEM';
  const kind = params.get('kind') ?? 'offer'; // offer | request

  const isOffer = kind === 'offer';

  const people: Person[] = useMemo(() => {
    if (isOffer) {
      return [
        { id: 'req-1', name: 'Lorem ipsum name' },
        { id: 'req-2', name: 'Anonymous' },
        { id: 'req-3', name: 'User C' },
      ];
    }
    return [{ id: 'prov-1', name: 'Provider name' }];
  }, [isOffer]);

  const [activePersonId, setActivePersonId] = useState<string>(people[0]?.id ?? 'req-1');
  const activePerson = people.find((p) => p.id === activePersonId) ?? people[0];

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'm1',
      sender: 'them',
      content: isOffer
        ? 'Hi! I’m interested in your offer.'
        : 'Hi! I can help with your request.',
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
  ]);
  const [draft, setDraft] = useState('');

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: 'you', content: text, createdAt: new Date().toISOString() },
    ]);
    setDraft('');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 min-h-0 flex pb-28">
        {/* Sidebar: requesters (offers) / provider (requests) */}
        <aside className="w-20 border-r border-gray-200 bg-white flex flex-col items-center py-3 gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full border border-[#3761B0] text-[#3761B0] flex items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center gap-3 pt-1">
            {people.map((p) => {
              const isActive = p.id === activePersonId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePersonId(p.id)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isActive ? 'border-[#3761B0] bg-blue-50' : 'border-transparent bg-gray-200'
                  }`}
                  aria-label={p.name}
                  title={p.name}
                >
                  <span className="text-gray-700 font-semibold text-sm">{initials(p.name)}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
              <span className="text-gray-700 font-semibold text-xs">
                {initials(activePerson?.name ?? 'User')}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 leading-tight line-clamp-1">{title}</p>
              <p className="text-xs text-gray-500 leading-tight line-clamp-1">
                {isOffer ? 'Chat with requester: ' : 'Chat with provider: '}
                {activePerson?.name ?? '—'}
              </p>
            </div>
            <button
              type="button"
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
              aria-label="Menu"
            >
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </header>

          {/* Messages */}
          <main className="flex-1 overflow-y-auto px-4 py-4 bg-white">
            <div className="max-w-xl mx-auto space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === 'you' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.sender === 'you'
                        ? 'bg-[#3761B0] text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </main>

          {/* Composer */}
          <footer className="border-t border-gray-200 bg-white px-4 py-3">
            <div className="max-w-xl mx-auto flex items-center gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message"
                className="flex-1 h-11 rounded-full bg-gray-200 px-4 text-sm outline-none focus:ring-2 focus:ring-[#3761B0]/30"
                aria-label="Message"
              />
              <button
                type="button"
                onClick={handleSend}
                className="w-11 h-11 rounded-full bg-[#E5A550] hover:bg-[#D89440] transition-colors text-white flex items-center justify-center shrink-0"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </footer>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

