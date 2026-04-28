"use client";

import type { PinPosition, ThreadConnection, ThreadType } from "./corkboardTypes";
import { getThreadPath } from "./CorkboardLayout";

interface CorkboardThreadProps {
  from: PinPosition;
  to: PinPosition;
  isActive: boolean;
  visible: boolean;
  onThreadClick?: (thread: ThreadConnection) => void;
  thread: ThreadConnection;
  currentMemId?: string | null;
}

const THREAD_STYLE: Record<ThreadType, { color: string; width: number; opacity: number; connectedOpacity: number }> = {
  temporal: { color: "rgba(232, 224, 208, 0.34)", width: 0.65, opacity: 0.14, connectedOpacity: 0.24 },
  person: { color: "rgba(202, 214, 178, 0.32)", width: 0.75, opacity: 0.12, connectedOpacity: 0.22 },
  branch: { color: "rgba(210, 164, 150, 0.3)", width: 0.7, opacity: 0.1, connectedOpacity: 0.2 },
  era: { color: "rgba(194, 184, 165, 0.26)", width: 0.55, opacity: 0.08, connectedOpacity: 0.16 },
  "co-subject": { color: "rgba(202, 214, 178, 0.28)", width: 0.6, opacity: 0.1, connectedOpacity: 0.18 },
  place: { color: "rgba(210, 164, 150, 0.28)", width: 0.6, opacity: 0.09, connectedOpacity: 0.18 },
};

const THREAD_ACTIVE_WIDTH = 1.35;
const THREAD_ACTIVE_OPACITY = 0.78;

function gradientIdForThread(thread: ThreadConnection) {
  return `corkboard-active-thread-${thread.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function CorkboardThread({
  from,
  to,
  isActive,
  visible,
  onThreadClick,
  thread,
  currentMemId,
}: CorkboardThreadProps) {
  if (!visible) return null;

  const threadStyle = THREAD_STYLE[thread.type] ?? THREAD_STYLE.temporal;
  const pathD = getThreadPath(from, to, thread.type);
  const isConnectedToCurrent =
    currentMemId != null && (thread.from === currentMemId || thread.to === currentMemId);
  const opacity = isActive ? THREAD_ACTIVE_OPACITY : isConnectedToCurrent ? threadStyle.connectedOpacity : threadStyle.opacity;
  const width = isActive ? THREAD_ACTIVE_WIDTH : threadStyle.width;
  const gradientId = gradientIdForThread(thread);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onThreadClick?.(thread);
  };

  return (
    <g className={`corkboard-thread corkboard-thread--${thread.type}${isActive ? " corkboard-thread--active" : ""}`}>
      {isActive && (
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
          >
            <stop offset="0%" stopColor="rgba(232, 224, 208, 0)" />
            <stop offset="24%" stopColor="rgba(232, 224, 208, 0.26)" />
            <stop offset="58%" stopColor="rgba(255, 246, 222, 0.9)" />
            <stop offset="100%" stopColor="rgba(232, 224, 208, 0.12)" />
          </linearGradient>
        </defs>
      )}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        strokeLinecap="round"
        style={{ cursor: "pointer", pointerEvents: "stroke" }}
        onClick={handleClick}
      />
      {isActive && (
        <path
          d={pathD}
          fill="none"
          stroke="rgba(255, 238, 196, 0.18)"
          strokeWidth={7}
          strokeLinecap="round"
          opacity={0.55}
          className="corkboard-thread-glow"
          style={{ pointerEvents: "none" }}
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={isActive ? `url(#${gradientId})` : threadStyle.color}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={opacity}
        className={isActive ? "corkboard-thread-path--active" : "corkboard-thread-path"}
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
}

interface CorkboardThreadLayerProps {
  threads: ThreadConnection[];
  pins: PinPosition[];
  activeThreadId: string | null;
  activeRoute?: { from: string; to: string } | null;
  visibility: { temporal: boolean; person: boolean; branch: boolean; era: boolean; place: boolean };
  width: number;
  height: number;
  onThreadClick?: (thread: ThreadConnection) => void;
  currentMemId: string | null;
}

const VISIBILITY_MAP: Record<ThreadType, keyof CorkboardThreadLayerProps["visibility"]> = {
  temporal: "temporal",
  person: "person",
  branch: "branch",
  era: "era",
  "co-subject": "person",
  place: "place",
};

export function CorkboardThreadLayer({
  threads,
  pins,
  activeThreadId,
  activeRoute,
  visibility,
  width,
  height,
  onThreadClick,
  currentMemId,
}: CorkboardThreadLayerProps) {
  const pinById = new Map(pins.map((p) => [p.memoryId, p]));
  const renderedPairs = new Set<string>();
  const pairKey = (from: string, to: string) => [from, to].sort().join("|");

  return (
    <svg
      className="corkboard-thread-layer"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {threads.map((thread) => {
        const fromPin = pinById.get(thread.from);
        const toPin = pinById.get(thread.to);
        if (!fromPin || !toPin) return null;
        const visKey = VISIBILITY_MAP[thread.type];
        if (!visKey || !visibility[visKey]) return null;
        renderedPairs.add(pairKey(thread.from, thread.to));

        return (
          <CorkboardThread
            key={thread.id}
            from={fromPin}
            to={toPin}
            isActive={thread.id === activeThreadId}
            visible
            onThreadClick={onThreadClick}
            thread={thread}
            currentMemId={currentMemId}
          />
        );
      })}
      {activeRoute &&
        !renderedPairs.has(pairKey(activeRoute.from, activeRoute.to)) &&
        (() => {
          const fromPin = pinById.get(activeRoute.from);
          const toPin = pinById.get(activeRoute.to);
          if (!fromPin || !toPin) return null;
          const syntheticThread: ThreadConnection = {
            id: "active-route",
            from: activeRoute.from,
            to: activeRoute.to,
            type: "temporal",
            strength: 1,
          };
          return (
            <CorkboardThread
              from={fromPin}
              to={toPin}
              isActive
              visible
              onThreadClick={onThreadClick}
              thread={syntheticThread}
              currentMemId={currentMemId}
            />
          );
        })()}
    </svg>
  );
}
