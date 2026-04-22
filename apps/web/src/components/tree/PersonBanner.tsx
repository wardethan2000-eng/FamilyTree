"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ApiPerson } from "./treeTypes";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PersonBannerProps {
  person: ApiPerson | null;
  treeId: string;
  onClose: () => void;
  onEnterLife: (personId: string) => void;
  onPersonUpdated?: () => void;
}

type EditField = "display_name" | "birth_date_text" | "death_date_text" | "essence_line";

export function PersonBanner({
  person,
  treeId,
  onClose,
  onEnterLife,
  onPersonUpdated,
}: PersonBannerProps) {
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback((field: EditField, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!person || !editingField) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/trees/${treeId}/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [editingField]: editValue || null }),
      });
      if (res.ok) {
        onPersonUpdated?.();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }, [person, editingField, editValue, treeId, onPersonUpdated]);

  useEffect(() => {
    if (!person) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [person, onClose]);

  if (!person) return null;

  const initials = person.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const dateLabel =
    person.birthYear && person.deathYear
      ? `${person.birthYear} – ${person.deathYear}`
      : person.birthYear
        ? `b. ${person.birthYear}`
        : null;

  const displayName = person.name;
  const essenceLine = person.essenceLine;

  return (
    <AnimatePresence>
      {person && (
        <motion.div
          key="person-banner"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 320,
            zIndex: 20,
            background: "var(--paper)",
            borderLeft: "1px solid var(--rule)",
            boxShadow: "-8px 0 32px rgba(28,25,21,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "48px 24px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              borderBottom: "1px solid var(--rule)",
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                overflow: "hidden",
                border: "1.5px solid var(--rule)",
                background: "var(--paper-deep)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {person.portraitUrl ? (
                <img
                  src={person.portraitUrl}
                  alt={displayName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 32,
                    color: "var(--ink-faded)",
                    fontWeight: 400,
                    lineHeight: 1,
                  }}
                >
                  {initials}
                </span>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              {editingField === "display_name" ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditingField(null);
                  }}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    color: "var(--ink)",
                    textAlign: "center",
                    width: "100%",
                    border: "none",
                    borderBottom: "1px solid var(--moss)",
                    background: "transparent",
                    outline: "none",
                    padding: "2px 0",
                  }}
                />
              ) : (
                <div
                  onClick={() => startEdit("display_name", displayName)}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    color: "var(--ink)",
                    lineHeight: 1.2,
                    letterSpacing: "-0.01em",
                    cursor: "text",
                  }}
                >
                  {displayName}
                </div>
              )}

              {editingField !== "display_name" && dateLabel && (
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    color: "var(--ink-faded)",
                    marginTop: 4,
                  }}
                >
                  {dateLabel}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <FieldSection
              label="Dates"
              fields={[
                {
                  key: "birth_date_text",
                  label: "Born",
                  value: person.birthYear != null ? String(person.birthYear) : "",
                  editable: true,
                },
                {
                  key: "death_date_text",
                  label: "Died",
                  value: person.deathYear != null ? String(person.deathYear) : "",
                  editable: true,
                },
              ]}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={(field: string, value: string) => startEdit(field as EditField, value)}
              onEditValueChange={setEditValue}
              onSave={saveEdit}
              saving={saving}
            />

            <FieldSection
              label="Essence"
              fields={[
                {
                  key: "essence_line",
                  label: "",
                  value: essenceLine ?? "",
                  editable: true,
                },
              ]}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={(field: string, value: string) => startEdit(field as EditField, value)}
              onEditValueChange={setEditValue}
              onSave={saveEdit}
              saving={saving}
            />

            <button
              onClick={() => onEnterLife(person.id)}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                color: "var(--paper)",
                background: "var(--ink)",
                border: "none",
                borderRadius: 4,
                padding: "10px 0",
                cursor: "pointer",
                letterSpacing: "0.02em",
                width: "100%",
                transition: "background 150ms cubic-bezier(0.22, 0.61, 0.36, 1)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ink)")}
            >
              Enter life story →
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "transparent",
              border: "none",
              padding: 8,
              cursor: "pointer",
              color: "var(--ink-faded)",
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FieldSection({
  label,
  fields,
  editingField,
  editValue,
  onStartEdit,
  onEditValueChange,
  onSave,
  saving,
}: {
  label: string;
  fields: Array<{ key: string; label: string; value: string; editable?: boolean }>;
  editingField: string | null;
  editValue: string;
  onStartEdit: (field: string, value: string) => void;
  onEditValueChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div>
      {label && (
        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--ink-faded)",
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {fields.map((field) => {
          const isEditing = editingField === field.key;
          return (
            <div key={field.key}>
              {field.label && (
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 10,
                    color: "var(--ink-faded)",
                    marginBottom: 2,
                  }}
                >
                  {field.label}
                </div>
              )}
              {isEditing ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => onEditValueChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSave();
                      if (e.key === "Escape") onStartEdit("", "");
                    }}
                    style={{
                      flex: 1,
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      color: "var(--ink)",
                      border: "none",
                      borderBottom: "1px solid var(--moss)",
                      background: "transparent",
                      outline: "none",
                      padding: "2px 0",
                    }}
                  />
                  <button
                    onClick={onSave}
                    disabled={saving}
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      color: "var(--moss)",
                      background: "transparent",
                      border: "1px solid var(--moss)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      cursor: saving ? "default" : "pointer",
                      opacity: saving ? 0.5 : 1,
                    }}
                  >
                    {saving ? "..." : "Save"}
                  </button>
                </div>
              ) : (
                <div
                  onClick={field.editable ? () => onStartEdit(field.key, field.value) : undefined}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: field.value ? "var(--ink)" : "var(--ink-faded)",
                    cursor: field.editable ? "text" : "default",
                    borderBottom: field.editable ? "1px dashed var(--rule)" : "none",
                    padding: "2px 0",
                    fontStyle: field.value ? "normal" : "italic",
                  }}
                >
                  {field.value || (field.editable ? "Add…" : "—")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}