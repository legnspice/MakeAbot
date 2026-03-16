'use client';

import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';

const SAMPLE_NOTIFICATIONS = [
  {
    id: '1',
    title: 'New Request for [OFFER NAME]',
    body: 'made by [Lorem ipsum name]',
    meta: '6:09 P.M.',
  },
  {
    id: '2',
    title: 'New Message from [Lorem ipsum name]',
    body: 'on [OFFER NAME]',
    meta: 'Jan 22',
  },
];

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 pb-28">
        <section aria-label="Notifications">
          <div className="divide-y divide-gray-200 border-t border-b border-gray-200 bg-white">
            {SAMPLE_NOTIFICATIONS.map((n) => (
              <button
                key={n.id}
                type="button"
                className="w-full text-left px-4 py-4 focus:outline-none focus-visible:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                      {n.title}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500 mt-1">{n.meta}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

