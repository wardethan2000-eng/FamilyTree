"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { getApiBase } from "@/lib/api-base";

const API = getApiBase();
const CONCURRENT_UPLOADS = 4;
const ACCEPTED_TYPES = "image/*,video/*,audio/*,.pdf,.doc,.docx,application/pdf,application/msword,application/zip,application/x-zip-compressed";

interface PersonOption {
  id: string;
  displayName: string;
}

interface ImportBatch {
  id: string;
  label: string;
  status: string;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  defaultPerson: { id: string; name: string } | null;
  createdAt: string;
}

interface PresignedImportItem {
  itemId: string;
  mediaId: string;
  uploadUrl: string;
  objectKey: string;
  filename: string;
}

type UploadPhase = "idle" | "creating" | "presigning" | "uploading" | "completing" | "done";

function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
}

export default function ImportCollectionPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [people, setPeople] = useState<PersonOption[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [personId, setPersonId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, currentFile: "" });
  const [error, setError] = useState<string | null>(null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/auth/signin");
  }, [isPending, router, session]);

  const refresh = useCallback(async () => {
    if (!treeId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [peopleRes, batchesRes] = await Promise.all([
        fetch(`${API}/api/trees/${treeId}/people`, { credentials: "include" }),
        fetch(`${API}/api/trees/${treeId}/import-batches`, { credentials: "include" }),
      ]);
      if (!peopleRes.ok) throw new Error("Could not load people.");
      if (!batchesRes.ok) throw new Error("Could not load imports.");
      const peopleData = (await peopleRes.json()) as Array<{
        id: string;
        displayName?: string;
        name?: string;
      }>;
      const normalizedPeople = peopleData.map((person) => ({
        id: person.id,
        displayName: person.displayName ?? person.name ?? "Unnamed",
      }));
      setPeople(normalizedPeople);
      setPersonId((current) => current || normalizedPeople[0]?.id || "");
      const batchData = (await batchesRes.json()) as { batches?: ImportBatch[] };
      setBatches(batchData.batches ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load import tools.");
    } finally {
      setLoading(false);
    }
  }, [treeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const suggestedLabel = useMemo(() => {
    const today = new Date();
    return `Imported ${today.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }, []);

  const totalSize = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

  const uploading = phase !== "idle" && phase !== "done";

  function addFiles(newFiles: FileList | File[]) {
    setError(null);
    setLastBatchId(null);
    const existingNames = new Set(files.map((f) => f.name));
    const uniqueNew = Array.from(newFiles).filter((f) => !existingNames.has(f.name));
    setFiles((prev) => [...prev, ...uniqueNew]);
    setLabel((current) => current || suggestedLabel);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function onFileChange(nextFiles: FileList | null) {
    if (!nextFiles) return;
    addFiles(nextFiles);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  async function uploadImport() {
    if (!personId) {
      setError("Choose who these memories are mostly about.");
      return;
    }
    if (files.length === 0) {
      setError("Choose at least one file.");
      return;
    }

    setError(null);
    setPhase("creating");
    setLastBatchId(null);

    try {
      const isZip = files.length === 1 && isZipFile(files[0]!);

      const batchRes = await fetch(`${API}/api/trees/${treeId}/import-batches`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || suggestedLabel,
          defaultPersonId: personId,
          ...(isZip ? { sourceKind: "zip_upload" } : {}),
        }),
      });
      if (!batchRes.ok) {
        const body = (await batchRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not create import.");
      }
      const batch = (await batchRes.json()) as { id: string };

      if (isZip) {
        setPhase("presigning");
        const presignRes = await fetch(
          `${API}/api/trees/${treeId}/import-batches/${batch.id}/zip-presign`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: files[0]!.name,
              contentType: "application/zip",
              sizeBytes: files[0]!.size,
            }),
          },
        );
        if (!presignRes.ok) {
          const body = (await presignRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not prepare ZIP upload.");
        }
        const presigned = (await presignRes.json()) as { uploadUrl: string };

        setPhase("uploading");
        setUploadProgress({ done: 0, total: 1, currentFile: files[0]!.name });
        const uploadRes = await fetch(presigned.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/zip" },
          body: files[0],
        });
        if (!uploadRes.ok) {
          throw new Error("ZIP upload failed.");
        }
        setUploadProgress({ done: 1, total: 1, currentFile: "" });

        setPhase("completing");
        const extractRes = await fetch(
          `${API}/api/trees/${treeId}/import-batches/${batch.id}/extract-zip`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          },
        );
        if (!extractRes.ok) {
          const body = (await extractRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not start ZIP extraction.");
        }
      } else {
        setPhase("presigning");
        const presignRes = await fetch(
          `${API}/api/trees/${treeId}/import-batches/${batch.id}/items/presign`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: files.map((file) => ({
                filename: file.name,
                contentType: file.type || "application/octet-stream",
                sizeBytes: file.size,
                lastModified: file.lastModified,
              })),
            }),
          },
        );
        if (!presignRes.ok) {
          const body = (await presignRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not prepare uploads.");
        }
        const presigned = (await presignRes.json()) as { items: PresignedImportItem[] };

        setPhase("uploading");
        const total = presigned.items.length;
        setUploadProgress({ done: 0, total, currentFile: "" });

        let completed = 0;
        const uploadTasks = presigned.items.map((item, index) => {
          const file = files[index];
          return async () => {
            if (!file) return;
            setUploadProgress((prev) => ({ ...prev, currentFile: file.name }));
            const uploadRes = await fetch(item.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": file.type || "application/octet-stream" },
              body: file,
            });
            if (!uploadRes.ok) {
              throw new Error(`Upload failed for ${file.name}.`);
            }
            completed += 1;
            setUploadProgress({ done: completed, total, currentFile: "" });
          };
        });

        let nextTaskIndex = 0;
        const runNext = async (): Promise<void> => {
          while (nextTaskIndex < uploadTasks.length) {
            const taskIndex = nextTaskIndex++;
            await uploadTasks[taskIndex]!();
          }
        };
        const workers = Array.from({ length: Math.min(CONCURRENT_UPLOADS, uploadTasks.length) }, () => runNext());
        await Promise.all(workers);

        setPhase("completing");
        const completeRes = await fetch(
          `${API}/api/trees/${treeId}/import-batches/${batch.id}/complete`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ createMemories: true }),
          },
        );
        if (!completeRes.ok) {
          const body = (await completeRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not finish import.");
        }
      }

      setPhase("done");
      setLastBatchId(batch.id);
      setFiles([]);
      setLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setPhase("idle");
    }
  }

  if (isPending || loading) {
    return (
      <main style={pageStyle}>
        <p style={hintStyle}>Loading...</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <Link href={`/trees/${treeId}/settings`} style={backLinkStyle}>
          Back to archive settings
        </Link>

        <header>
          <h1 style={titleStyle}>Import a collection</h1>
          <p style={leadStyle}>
            Bring in many files at once. Tessera will create draft memories for
            one person, then send you to the review queue to add dates and
            places.
          </p>
        </header>

        {loadError && <p style={errorStyle}>{loadError}</p>}

        <section style={cardStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Import name</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={suggestedLabel}
              style={inputStyle}
              disabled={uploading}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Who are these mostly about?</span>
            <select
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
              style={inputStyle}
              disabled={uploading}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </label>

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
              ...dropStyle,
              ...(isDragOver ? dropActiveStyle : {}),
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              onChange={(event) => onFileChange(event.target.files)}
              style={{ display: "none" }}
            />
            <span style={dropTitleStyle}>
              {files.length > 0
                ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
                : "Drop files here, or click to browse"}
            </span>
            <span style={dropHintStyle}>
              {files.length > 0
                ? `${formatBytes(totalSize)} ready to import — photos, videos, audio, documents, or a ZIP archive`
                : "Drag photos, videos, audio, or documents. You can also upload a ZIP archive."}
            </span>
            {files.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                style={clearButtonStyle}
                disabled={uploading}
              >
                Clear all
              </button>
            )}
          </div>

          {files.length > 0 && (
            <div style={fileListStyle}>
              {files.slice(0, 20).map((file, index) => (
                <div key={`${file.name}-${file.size}`} style={fileRowStyle}>
                  <span style={fileNameStyle}>{file.name}</span>
                  <span style={fileSizeStyle}>{formatBytes(file.size)}</span>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      style={removeButtonStyle}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              {files.length > 20 && (
                <p style={hintStyle}>
                  ...and {files.length - 20} more file{files.length - 20 === 1 ? "" : "s"}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void uploadImport()}
            disabled={uploading || files.length === 0 || !personId}
            style={{
              ...primaryButtonStyle,
              opacity: uploading || files.length === 0 || !personId ? 0.55 : 1,
              cursor: uploading ? "wait" : "pointer",
            }}
          >
            {phase === "idle" && "Import files"}
            {phase === "creating" && "Creating import..."}
            {phase === "presigning" && "Preparing uploads..."}
            {phase === "uploading" && `Uploading ${uploadProgress.done + 1} of ${uploadProgress.total}...`}
            {phase === "completing" && "Creating memories..."}
            {phase === "done" && "Import complete"}
          </button>

          {uploading && (
            <div style={progressBarContainerStyle}>
              <div
                style={{
                  ...progressBarFillStyle,
                  width: `${uploadProgress.total > 0 ? (uploadProgress.done / uploadProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
          )}

          {error && <p style={errorStyle}>{error}</p>}
          {lastBatchId && (
            <Link
              href={`/trees/${treeId}/curation?batchId=${encodeURIComponent(lastBatchId)}`}
              style={reviewLinkStyle}
            >
              Review this import
            </Link>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Recent imports</h2>
          {batches.length === 0 ? (
            <p style={hintStyle}>No collections have been imported yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {batches.map((batch) => (
                <div key={batch.id} style={batchRowInnerStyle}>
                  <Link
                    href={`/trees/${treeId}/curation?batchId=${encodeURIComponent(batch.id)}`}
                    style={{ ...batchRowStyle, flex: 1 }}
                  >
                    <span>
                      <strong>{batch.label}</strong>
                      <small>
                        {batch.defaultPerson?.name ?? "No person"} - {batch.processedItems} of{" "}
                        {batch.totalItems} imported
                      </small>
                    </span>
                    <span style={statusPillStyle}>{batch.status}</span>
                  </Link>
                  <Link
                    href={`/trees/${treeId}/import/${batch.id}/duplicates`}
                    style={dupLinkStyle}
                  >
                    Dupes
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "var(--paper)",
  color: "var(--ink)",
  padding: "48px 24px",
};
const containerStyle: CSSProperties = {
  width: "min(760px, 100%)",
  margin: "0 auto",
  display: "grid",
  gap: 24,
};
const backLinkStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--ink-faded)",
  textDecoration: "none",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 34,
  fontWeight: 400,
  margin: "0 0 8px",
};
const leadStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  lineHeight: 1.7,
  color: "var(--ink-soft)",
  margin: 0,
};
const cardStyle: CSSProperties = {
  background: "var(--paper-deep)",
  border: "1px solid var(--rule)",
  borderRadius: 12,
  padding: 24,
  display: "grid",
  gap: 16,
};
const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 7,
};
const labelStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--ink-soft)",
  fontWeight: 600,
};
const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--rule)",
  borderRadius: 8,
  background: "var(--paper)",
  color: "var(--ink)",
  fontFamily: "var(--font-ui)",
  fontSize: 15,
  padding: "11px 12px",
};
const dropStyle: CSSProperties = {
  border: "2px dashed var(--rule)",
  borderRadius: 12,
  background: "var(--paper)",
  padding: "34px 18px",
  textAlign: "center",
  display: "grid",
  gap: 8,
  cursor: "pointer",
  transition: "border-color 0.2s, background 0.2s",
};
const dropActiveStyle: CSSProperties = {
  borderColor: "var(--moss)",
  background: "var(--paper-deep)",
};
const dropTitleStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--ink)",
};
const dropHintStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--ink-faded)",
};
const clearButtonStyle: CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: 6,
  background: "var(--paper)",
  color: "var(--ink-faded)",
  fontSize: 12,
  padding: "4px 10px",
  cursor: "pointer",
};
const fileListStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  maxHeight: 200,
  overflowY: "auto",
  padding: "8px 0",
};
const fileRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 8px",
  borderRadius: 6,
  background: "var(--paper)",
};
const fileNameStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const fileSizeStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  color: "var(--ink-faded)",
};
const removeButtonStyle: CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--ink-faded)",
  fontSize: 16,
  cursor: "pointer",
  padding: "0 4px",
  lineHeight: 1,
};
const primaryButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 8,
  background: "var(--moss)",
  color: "var(--paper)",
  fontFamily: "var(--font-ui)",
  fontSize: 15,
  fontWeight: 700,
  padding: "13px 18px",
};
const hintStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--ink-faded)",
};
const errorStyle: CSSProperties = {
  ...hintStyle,
  color: "var(--rose)",
};
const reviewLinkStyle: CSSProperties = {
  ...primaryButtonStyle,
  display: "inline-flex",
  justifyContent: "center",
  textDecoration: "none",
};
const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: 22,
  fontWeight: 400,
};
const batchRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  border: "1px solid var(--rule)",
  borderRadius: 10,
  background: "var(--paper)",
  padding: "13px 14px",
  textDecoration: "none",
  color: "var(--ink)",
  fontFamily: "var(--font-ui)",
};
const batchRowInnerStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "stretch",
};
const dupLinkStyle: CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: 8,
  background: "var(--paper)",
  color: "var(--ink-faded)",
  fontFamily: "var(--font-ui)",
  fontSize: 12,
  padding: "6px 10px",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  whiteSpace: "nowrap",
};
const statusPillStyle: CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: 999,
  padding: "4px 9px",
  color: "var(--ink-faded)",
  fontSize: 11,
};
const progressBarContainerStyle: CSSProperties = {
  height: 6,
  background: "var(--rule)",
  borderRadius: 3,
  overflow: "hidden",
};
const progressBarFillStyle: CSSProperties = {
  height: "100%",
  background: "var(--moss)",
  borderRadius: 3,
  transition: "width 0.3s ease",
};