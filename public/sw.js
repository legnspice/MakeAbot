self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "New notification", body: "", url: "/" };
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Silent push: if user is already on the relevant chat page, skip OS notification.
        // The bell badge updates automatically via Supabase Realtime.
        if (data.tag) {
          const bidId = data.tag.replace("chat_", "");
          const isOnChat = windowClients.some(
            (c) => c.url.includes(`bidId=${bidId}`),
          );
          if (isOnChat) return;
        }

        return self.registration.showNotification(data.title, {
          body: data.body ?? "",
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          tag: data.tag,       // browser collapses notifications with same tag
          renotify: false,     // replace silently — no new sound/vibration
          data: { url: data.url ?? "/" },
        });
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
