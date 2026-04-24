"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import type { TreeHomeCoverage, TreeHomeMemory, TreeHomeMemoryTrailSection, TreeHomeTodayHighlights } from "./homeTypes";
import { useAtriumWalk, type WalkPace, type WalkRoom } from "./useAtriumWalk";
import { FoyerRoom } from "./walk-rooms/FoyerRoom";
import { MemoryRoom } from "./walk-rooms/MemoryRoom";
import { AnteroomRoom } from "./walk-rooms/AnteroomRoom";
import { DisplayCaseRoom } from "./walk-rooms/DisplayCaseRoom";
import { PortraitWallRoom } from "./walk-rooms/PortraitWallRoom";

interface TrailPerson {
  id: string;
  name: string;
  portraitUrl: string | null;
}

interface PersonSummary {
  id: string;
  name: string;
  portraitUrl: string | null;
  essenceLine: string | null;
  birthYear: number | null;
  deathYear: number | null;
}

interface FamilyPresenceGroup {
  id: string;
  label: string;
  people: PersonSummary[];
}

interface AtriumWalkProps {
  treeId: string;
  treeName: string;
  featuredMemory: TreeHomeMemory | null;
  trailSections: TreeHomeMemoryTrailSection[];
  today: TreeHomeTodayHighlights | null;
  familyPresenceGroups: FamilyPresenceGroup[];
  focusPerson: PersonSummary | null;
  focusPersonName: string | null;
  branchCue: string;
  archiveSummary: {
    peopleCount: number;
    generationCount: number;
    earliestYear: number | null;
    latestYear: number | null;
    branchLabel: string | null;
  } | null;
  coverage: TreeHomeCoverage | null;
  people: TrailPerson[];
  resurfacingCount: number;
  memoryHref: string | null;
  branchHref: string | null;
  fullTreeHref: string;
  pace: WalkPace;
  onPersonClick: (personId: string) => void;
  onMemoryClick: (memory: TreeHomeMemory) => void;
  onDrift: () => void;
  onStartPersonDrift: (personId: string) => void;
  onStartRemembrance: (personId: string) => void;
}

const TRANSITION_DURATION = 1.0;
const TRANSITION_EASE = [0.22, 0.61, 0.36, 1] as const;

const roomVariants = {
  enter: (direction: "forward" | "backward" | null) => ({
    opacity: 0,
    scale: direction === "backward" ? 0.985 : 1.015,
  }),
  center: {
    opacity: 1,
    scale: 1,
  },
  exit: (direction: "forward" | "backward" | null) => ({
    opacity: 0,
    scale: direction === "forward" ? 0.985 : 1.015,
  }),
};

function formatScaleLabel(
  archiveSummary: AtriumWalkProps["archiveSummary"],
  peopleCount: number,
): string {
  const count = archiveSummary?.peopleCount ?? peopleCount;
  const generations = archiveSummary?.generationCount ?? 0;
  if (count === 0) return "No people have been added yet.";
  if (generations > 0) {
    return `${count} ${count === 1 ? "person" : "people"} across ${generations} ${generations === 1 ? "generation" : "generations"}`;
  }
  return `${count} ${count === 1 ? "person" : "people"} taking shape`;
}

function formatHistoricalLabel(
  archiveSummary: AtriumWalkProps["archiveSummary"],
  coverage: TreeHomeCoverage | null,
): string {
  const earliestYear = archiveSummary?.earliestYear ?? coverage?.earliestYear ?? null;
  const latestYear = archiveSummary?.latestYear ?? coverage?.latestYear ?? null;
  if (earliestYear === null && latestYear === null) return "Dates are still gathering.";
  if (earliestYear !== null && latestYear !== null) {
    if (earliestYear === latestYear) return `Memories center on ${earliestYear}.`;
    return `Memories stretch from ${earliestYear} to ${latestYear}.`;
  }
  return `Memories anchor around ${earliestYear ?? latestYear}.`;
}

export function AtriumWalk({
  treeId,
  treeName,
  featuredMemory,
  trailSections,
  today,
  familyPresenceGroups,
  focusPerson,
  focusPersonName,
  branchCue,
  archiveSummary,
  coverage,
  people,
  resurfacingCount,
  memoryHref,
  branchHref,
  fullTreeHref,
  pace,
  onPersonClick,
  onMemoryClick,
  onDrift,
  onStartPersonDrift,
  onStartRemembrance,
}: AtriumWalkProps) {
  const hasTodayHighlights = useMemo(() => {
    if (!today) return false;
    const b = today.birthdays.some((p) => p.daysUntil === 0);
    const d = today.deathiversaries.some((p) => p.daysUntil === 0);
    const a = today.memoryAnniversaries.some((p) => p.daysUntil === 0);
    return b || d || a;
  }, [today]);

  const hasUpcoming = useMemo(() => {
    if (!today) return false;
    return (
      today.birthdays.some((p) => p.daysUntil > 0) ||
      today.deathiversaries.some((p) => p.daysUntil > 0) ||
      today.memoryAnniversaries.some((p) => p.daysUntil > 0)
    );
  }, [today]);

  const rooms: WalkRoom[] = useMemo(() => {
    const result: WalkRoom[] = [];

    if (hasTodayHighlights || hasUpcoming) {
      result.push({ id: "anteroom", type: "anteroom", data: today });
    }

    result.push({
      id: "foyer",
      type: "foyer",
      data: featuredMemory,
    });

    for (const section of trailSections) {
      for (const memory of section.memories) {
        result.push({
          id: `memory:${memory.id}`,
          type: "memory",
          data: memory,
        });
      }
    }

    result.push({
      id: "portrait-wall",
      type: "portrait-wall",
      data: null,
    });

    return result;
  }, [featuredMemory, trailSections, today, hasTodayHighlights, hasUpcoming]);

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  const {
    currentIndex,
    currentRoom,
    totalRooms,
    goNext,
    goPrev,
    goTo,
    isTransitioning,
    direction,
  } = useAtriumWalk({ rooms, pace });

  const scaleLabel = formatScaleLabel(archiveSummary, people.length);
  const historicalLabel = formatHistoricalLabel(archiveSummary, coverage);

  const renderRoom = (room: WalkRoom) => {
    switch (room.type) {
      case "anteroom":
        return (
          <AnteroomRoom
            treeId={treeId}
            today={today!}
            onStartPersonDrift={onStartPersonDrift}
            onStartRemembrance={onStartRemembrance}
          />
        );

      case "foyer":
        return (
          <FoyerRoom
            treeName={treeName}
            featuredMemory={featuredMemory}
            branchCue={branchCue}
            memoryHref={memoryHref}
            branchHref={branchHref}
            fullTreeHref={fullTreeHref}
            resurfacingCount={resurfacingCount}
            scaleLabel={scaleLabel}
            historicalLabel={historicalLabel}
            onDrift={onDrift}
          />
        );

      case "hallway": {
        return null;
      }

      case "memory": {
        const memory = room.data as TreeHomeMemory;
        return (
          <MemoryRoom
            memory={memory}
            peopleById={peopleById}
            memoryHref={`/trees/${treeId}/memories/${memory.id}`}
            onPersonClick={onPersonClick}
          />
        );
      }

      case "display-case": {
        const section = room.data as TreeHomeMemoryTrailSection;
        return (
          <DisplayCaseRoom
            title={section.title}
            description={section.description}
            memories={section.memories}
            peopleById={peopleById}
            onMemoryClick={onMemoryClick}
            onPersonClick={onPersonClick}
          />
        );
      }

      case "portrait-wall":
        return (
          <PortraitWallRoom
            focusPerson={focusPerson}
            focusPersonName={focusPersonName}
            branchCue={branchCue}
            groups={familyPresenceGroups}
            fullTreeHref={fullTreeHref}
            onPersonClick={onPersonClick}
          />
        );

      default:
        return null;
    }
  };

  if (totalRooms === 0) return null;

  return (
    <div
      id="atrium-walk"
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        touchAction: "pan-y",
        background: "var(--paper)",
      }}
    >
          <AnimatePresence mode="sync" initial={false} custom={direction}>
            {currentRoom && (
              <motion.div
                key={currentRoom.id}
                custom={direction}
                variants={roomVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  duration: TRANSITION_DURATION,
                  ease: TRANSITION_EASE,
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  overflowY: "auto",
                }}
              >
                {renderRoom(currentRoom)}
              </motion.div>
            )}
          </AnimatePresence>

      {totalRooms > 1 && (
        <WalkProgress
          current={currentIndex}
          total={totalRooms}
          onGoTo={goTo}
          isTransitioning={isTransitioning}
        />
      )}

      <WalkHint totalRooms={totalRooms} currentIndex={currentIndex} />
    </div>
  );
}

function WalkProgress({
  current,
  total,
  onGoTo,
  isTransitioning,
}: {
  current: number;
  total: number;
  onGoTo: (index: number) => void;
  isTransitioning: boolean;
}) {
  const lineTop = "calc(50% - 28vh)";
  const lineHeight = "56vh";
  const trackHeight = total <= 1 ? 0 : total - 1;
  const dotPosition = trackHeight > 0 ? `${(current / (total - 1)) * 100}%` : "0%";

  return (
    <div
      style={{
        position: "fixed",
        right: 14,
        top: lineTop,
        height: lineHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 15,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 1,
          height: "100%",
          background: "rgba(176,139,62,0.18)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translate(-50%, -50%)",
            top: dotPosition,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "rgba(176,139,62,0.50)",
            boxShadow: "0 0 0 3px rgba(176,139,62,0.08)",
            animation: "pulseDot 2.5s ease-in-out infinite",
            transition: "top 500ms cubic-bezier(0.22, 0.61, 0.36, 1)",
          }}
        />
      </div>

      {total > 1 && total <= 20 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            pointerEvents: "none",
            width: 11,
          }}
        >
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (!isTransitioning) onGoTo(i);
              }}
              style={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                border: "none",
                background: i === current ? "rgba(176,139,62,0.50)" : "rgba(176,139,62,0.16)",
                cursor: isTransitioning ? "default" : "pointer",
                pointerEvents: isTransitioning ? "none" : "auto",
                padding: 0,
                transition: "background 300ms ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WalkHint({
  totalRooms,
  currentIndex,
}: {
  totalRooms: number;
  currentIndex: number;
}) {
  if (totalRooms <= 2) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "clamp(20px, 3vw, 32px)",
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-faded)",
        opacity: 0.5,
        pointerEvents: "none",
        zIndex: 14,
        transition: "opacity 600ms ease",
      }}
    >
      {currentIndex === 0 ? "Scroll or press ↓ to continue" : `${currentIndex + 1} / ${totalRooms}`}
    </div>
  );
}