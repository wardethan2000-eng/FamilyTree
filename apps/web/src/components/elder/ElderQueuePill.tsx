"use client";

import { useEffect, useState } from "react";

const DB_NAME = "elder-queue";
const STORE = "submissions";

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function countQueue(): Promise<number> {
  try {
    const db = await openQueueDB();
    return await new Promise<number>((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return 0;
  }
}

export function ElderQueuePill() {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      countQueue().then((n) => {
        if (!cancelled) setCount(n);
      });
    };
    tick();
    const id = window.setInterval(tick, 4000);
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  if (count === 0 && online) return null;
  const message = !online
    ? count > 0
      ? `${count} memory waiting — will send when you're back online`
      : "You're offline. Anything you share will send when you're back online."
    : `${count} memory waiting to send…`;

  return (
    <div
      style={{
        background: "#EDE6D6",
        color: "#403A2E",
        padding: "10px 14px",
        borderRadius: 8,
        fontSize: 14,
        margin: "0 0 16px",
        border: "1px solid #D7CDB6",
      }}
    >
      {message}
    </div>
  );
}
