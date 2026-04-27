"use client";

import { useChromecast } from "@/hooks/useChromecast";

type CastButtonProps = {
  variant?: "icon" | "nav";
};

export function CastButton({ variant = "nav" }: CastButtonProps) {
  const { state, connect, disconnect } = useChromecast();

  // If the Cast SDK failed to load, the browser doesn't support Casting
  // (Safari, Firefox). Hide the button entirely in that case.
  if (state.error === "Cast SDK not available") return null;

  const handleCast = () => {
    if (state.isConnected) {
      disconnect();
    } else if (!state.isConnecting) {
      connect();
    }
  };

  const label = state.isConnected
    ? `Casting · ${state.deviceName ?? "TV"}`
    : state.isConnecting
      ? "Connecting…"
      : state.isAvailable
        ? "Cast to TV"
        : "Cast";

  const title = state.isConnected
    ? `Connected to ${state.deviceName ?? "TV"} — click to stop`
    : state.isConnecting
      ? "Connecting to your TV…"
      : state.isAvailable
        ? "Cast Drift to a Chromecast on your network"
        : "No Chromecast devices found on this network";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleCast}
        disabled={state.isConnecting || (!state.isAvailable && !state.isConnected)}
        aria-label={title}
        title={title}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: state.isConnected ? "var(--moss, #4a7c59)" : "transparent",
          color: state.isConnected
            ? "white"
            : state.isAvailable
              ? "var(--ink, #1a1a1a)"
              : "var(--ink-faded, #999)",
          cursor:
            state.isConnecting || (!state.isAvailable && !state.isConnected)
              ? "not-allowed"
              : "pointer",
          opacity: !state.isAvailable && !state.isConnected ? 0.55 : 1,
          transition: "background 0.2s, color 0.2s, opacity 0.2s",
        }}
      >
        <CastIcon connected={state.isConnected} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCast}
      disabled={state.isConnecting || (!state.isAvailable && !state.isConnected)}
      aria-label={title}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        fontSize: 13,
        fontWeight: 500,
        borderRadius: 6,
        border: state.isConnected
          ? "1px solid rgba(78,93,66,0.4)"
          : "1px solid var(--rule, rgba(0,0,0,0.1))",
        background: state.isConnected ? "var(--moss, #4a7c59)" : "transparent",
        color: state.isConnected
          ? "#fff"
          : state.isAvailable
            ? "var(--ink, #1a1a1a)"
            : "var(--ink-faded, #999)",
        cursor:
          state.isConnecting || (!state.isAvailable && !state.isConnected)
            ? "not-allowed"
            : "pointer",
        opacity: !state.isAvailable && !state.isConnected ? 0.55 : 1,
        transition: "background 0.2s, color 0.2s, opacity 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      <CastIcon connected={state.isConnected} size={16} />
      <span>{label}</span>
    </button>
  );
}

function CastIcon({ connected, size = 24 }: { connected: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {connected ? (
        <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.92-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
      ) : (
        <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.92-11-11-11z" />
      )}
    </svg>
  );
}
