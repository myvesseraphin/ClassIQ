import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/client";

const POLL_INTERVAL_MS = 30000;

const parseTimestamp = (value) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const ts = date.getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const useNotificationPoller = (role) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNew, setHasNew] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [permission, setPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  const initializedRef = useRef(false);
  const lastNotifiedAtRef = useRef(0);
  const pulseTimerRef = useRef(null);

  useEffect(() => {
    try {
      const stored = Number(
        localStorage.getItem(`classiq:${role}:lastNotifiedAt`) || 0,
      );
      if (Number.isFinite(stored) && stored > 0) {
        lastNotifiedAtRef.current = stored;
      }
    } catch {
      // Ignore storage errors.
    }
  }, [role]);

  useEffect(() => {
    let active = true;
    api
      .get(`/${role}/profile`)
      .then(({ data }) => {
        if (!active) return;
        const nextEnabled = data?.settings?.notifications;
        if (nextEnabled !== undefined) {
          setEnabled(Boolean(nextEnabled));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [role]);

  const handleNewNotifications = (items) => {
    const unread = items.filter((n) => !n.read).length;
    setUnreadCount(unread);

    const mapped = items.map((n) => ({
      ...n,
      ts: parseTimestamp(n.createdAt),
    }));

    const newest = mapped.reduce((max, item) => Math.max(max, item.ts), 0);

    if (!initializedRef.current) {
      initializedRef.current = true;
      if (newest && lastNotifiedAtRef.current === 0) {
        lastNotifiedAtRef.current = newest;
        try {
          localStorage.setItem(
            `classiq:${role}:lastNotifiedAt`,
            String(newest),
          );
        } catch {
          // Ignore storage errors.
        }
      }
      return;
    }

    const lastNotifiedAt = lastNotifiedAtRef.current || 0;
    const fresh = mapped.filter(
      (item) => !item.read && item.ts && item.ts > lastNotifiedAt,
    );

    if (!fresh.length || !enabled) return;

    const latestIncoming = fresh.reduce(
      (max, item) => Math.max(max, item.ts),
      lastNotifiedAt,
    );
    lastNotifiedAtRef.current = latestIncoming;
    try {
      localStorage.setItem(
        `classiq:${role}:lastNotifiedAt`,
        String(latestIncoming),
      );
    } catch {
      // Ignore storage errors.
    }

    setHasNew(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setHasNew(false), 3500);

    if (typeof Notification !== "undefined" && permission === "granted") {
      fresh.slice(0, 3).forEach((item) => {
        try {
          new Notification(item.title || "New notification", {
            body: item.body || "",
          });
        } catch {
          // Ignore notification errors.
        }
      });
      return;
    }

    const message =
      fresh.length === 1
        ? fresh[0].title || "New notification received."
        : `${fresh.length} new notifications received.`;
    toast.info(message);
  };

  useEffect(() => {
    let active = true;
    let timer;

    const poll = async () => {
      try {
        const { data } = await api.get(`/${role}/notifications`);
        if (!active) return;
        const items = Array.isArray(data?.notifications)
          ? data.notifications
          : [];
        handleNewNotifications(items);
      } catch {
        // Ignore polling errors.
      }
    };

    poll();
    timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [role, enabled, permission]);

  const requestPermission = async () => {
    if (typeof Notification === "undefined" || !enabled) {
      return "unsupported";
    }
    if (Notification.permission !== "default") {
      setPermission(Notification.permission);
      return Notification.permission;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      const current = Notification.permission;
      setPermission(current);
      return current;
    }
  };

  return {
    unreadCount,
    hasNew,
    permission,
    enabled,
    requestPermission,
  };
};

export default useNotificationPoller;
