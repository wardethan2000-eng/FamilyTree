"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type WalkPace = "lingering" | "flowing";
export type WalkDirection = "forward" | "backward" | null;

export interface WalkRoom {
  id: string;
  type: "anteroom" | "foyer" | "hallway" | "memory" | "display-case" | "portrait-wall";
  data: unknown;
  autoAdvanceMs?: number;
}

interface UseAtriumWalkOptions {
  rooms: WalkRoom[];
  pace?: WalkPace;
  hallwayAutoAdvanceMs?: number;
}

interface UseAtriumWalkReturn {
  currentIndex: number;
  currentRoom: WalkRoom | null;
  totalRooms: number;
  goNext: () => void;
  goPrev: () => void;
  goTo: (index: number) => void;
  isTransitioning: boolean;
  direction: WalkDirection;
}

const TRANSITION_MS = 1200;
const WHEEL_DEBOUNCE_MS = 150;
const WHEEL_THRESHOLD_PX = 50;
const TOUCH_THRESHOLD_PX = 50;
const DEFAULT_HALLWAY_AUTO_MS = 2000;

export function useAtriumWalk({
  rooms,
  pace = "lingering",
  hallwayAutoAdvanceMs = DEFAULT_HALLWAY_AUTO_MS,
}: UseAtriumWalkOptions): UseAtriumWalkReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<WalkDirection>(null);

  const wheelAccumulator = useRef(0);
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number | null>(null);
  const transitioningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentRoom = useMemo(
    () => rooms[currentIndex] ?? null,
    [rooms, currentIndex],
  );
  const totalRooms = rooms.length;

  const advance = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= totalRooms - 1) return prev;
      setDirection("forward");
      setIsTransitioning(true);
      if (transitioningTimeout.current) clearTimeout(transitioningTimeout.current);
      transitioningTimeout.current = setTimeout(
        () => setIsTransitioning(false),
        TRANSITION_MS,
      );
      return prev + 1;
    });
  }, [totalRooms]);

  const goBack = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return prev;
      setDirection("backward");
      setIsTransitioning(true);
      if (transitioningTimeout.current) clearTimeout(transitioningTimeout.current);
      transitioningTimeout.current = setTimeout(
        () => setIsTransitioning(false),
        TRANSITION_MS,
      );
      return prev - 1;
    });
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalRooms) return;
      setDirection(index > currentIndex ? "forward" : "backward");
      setIsTransitioning(true);
      if (transitioningTimeout.current) clearTimeout(transitioningTimeout.current);
      transitioningTimeout.current = setTimeout(
        () => setIsTransitioning(false),
        TRANSITION_MS,
      );
      setCurrentIndex(index);
    },
    [totalRooms, currentIndex],
  );

  useEffect(() => {
    setCurrentIndex(0);
  }, [rooms]);

  useEffect(() => {
    if (!currentRoom || pace !== "flowing" || currentRoom.type !== "hallway") {
      if (autoAdvanceTimeout.current) {
        clearTimeout(autoAdvanceTimeout.current);
        autoAdvanceTimeout.current = null;
      }
      return;
    }

    if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);
    autoAdvanceTimeout.current = setTimeout(() => {
      advance();
    }, hallwayAutoAdvanceMs);

    return () => {
      if (autoAdvanceTimeout.current) {
        clearTimeout(autoAdvanceTimeout.current);
        autoAdvanceTimeout.current = null;
      }
    };
  }, [currentRoom, pace, hallwayAutoAdvanceMs, advance]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        if (!isTransitioning) advance();
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (!isTransitioning) goBack();
      }
      if (e.key === "Home") {
        e.preventDefault();
        if (!isTransitioning) goTo(0);
      }
      if (e.key === "End") {
        e.preventDefault();
        if (!isTransitioning) goTo(totalRooms - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advance, goBack, goTo, isTransitioning, totalRooms]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      wheelAccumulator.current += e.deltaY;

      if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
      wheelTimeout.current = setTimeout(() => {
        wheelAccumulator.current = 0;
      }, WHEEL_DEBOUNCE_MS);

      if (Math.abs(wheelAccumulator.current) >= WHEEL_THRESHOLD_PX) {
        wheelAccumulator.current = 0;
        if (wheelTimeout.current) clearTimeout(wheelTimeout.current);

        if (e.deltaY > 0 && !isTransitioning) {
          advance();
        } else if (e.deltaY < 0 && !isTransitioning) {
          goBack();
        }
      }
    };

    const container = document.getElementById("atrium-walk");
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
      if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
    };
  }, [advance, goBack, isTransitioning]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? null;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartY.current === null) return;
      const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
      const dy = touchStartY.current - endY;
      touchStartY.current = null;

      if (isTransitioning) return;

      if (dy > TOUCH_THRESHOLD_PX) {
        advance();
      } else if (dy < -TOUCH_THRESHOLD_PX) {
        goBack();
      }
    };

    const container = document.getElementById("atrium-walk");
    if (container) {
      container.addEventListener("touchstart", handleTouchStart, { passive: true });
      container.addEventListener("touchend", handleTouchEnd, { passive: true });
    }
    return () => {
      if (container) {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchend", handleTouchEnd);
      }
    };
  }, [advance, goBack, isTransitioning]);

  useEffect(() => {
    return () => {
      if (transitioningTimeout.current) clearTimeout(transitioningTimeout.current);
      if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);
    };
  }, []);

  return {
    currentIndex,
    currentRoom,
    totalRooms,
    goNext: advance,
    goPrev: goBack,
    goTo,
    isTransitioning,
    direction,
  };
}