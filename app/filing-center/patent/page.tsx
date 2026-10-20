"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

const STORAGE_KEY = "raysnotes-patent-draft-v1";

const initialForm = {
  packageTitle: "",
  inventorNames: "",
  contactEmail: "",
  inventionTitle: "",
  inventionCategory: "",
  problem: "",
  description: "",
  components: "",
  operation: "",
  differences: "",
  variations: "",
  developmentStatus: "",
  drawingsNotes: "",
  disclosureHistory: "",
  existingApplications: "",
  professionalQuestions: "",
};

type PatentForm = typeof initialForm;
type Field = keyof PatentForm;

const fields = Object.keys(initialForm) as Field[];

const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  marginTop: "8px",
  padding: "12px",
  background: "#080808",
  color: "#ffffff",
  border: "1px solid #666",
  borderRadius: "10px",
  font: "inherit",
};

const buttonStyle: CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  background: "#2563eb",
  color: "#ffffff",
  border: "1px solid #ffffff",
  borderRadius: "10px",
  textDecoration: "none",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};

export default function PatentPreparationPage() {
  const [form, setForm] = useState<PatentForm>(initialForm);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [message, setMessage] = useState("");
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed: unknown = JSON.parse(stored);

        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          throw new Error("Invalid draft");
        }

        const record = parsed as Record<string, unknown>;
        const restored = { ...initialForm };

        for (const field of fields) {
          const value = record[field];

          if (typeof value === "string") {
            restored[field] = value.slice(0, 5000);
          }
        }

        setForm(restored);
        setMessage("Your saved browser draft has been restored.");
      }
    } catch {
      setStorageAvailable(false);
      setMessage(
        "Your browser draft could not be loaded. Saving is disabled to protect any existing draft."
      );
    } finally {
      setReady(true);
    }
  }, []);

  function update(field: Field, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("You have changes to save.");
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ready || !storageAvailable) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      setSavedAt(new Date().toLocaleString());
      setMessage("Draft saved in this browser.");
    } catch {
      setMessage(
        "Draft could not be saved. Check your browser storage settings and try again."
      );
    }
  }

  function clearDraft() {
    if (!window.confirm("Delete this browser's patent draft?")) {
      return;
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
      setForm({ ...initialForm });
      setSavedAt("");
      setStorageAvailable(true);
      setMessage("Browser draft deleted.");
    } catch {
      setMessage("The browser draft could not be deleted.");
    }
  }

  function textField(
    field: Field,
    label: string,
    type = "text",
    hint?: string
  ) {
    return (
      <label style={{ display: "block" }}>
        {label}
        <input
          type={type}
          value={form[field]}
          onChange={(event) => update(field, event.target.value)}
          maxLength={500}
          style={inputStyle}
        />
        {hint && (
          <small
            style={{
              display: "block",
              marginTop: "6px",
              color: "#bbbbbb",
            }}
          >
            {hint}
          </small>
        )}
      </label>
    );
  }

  function textArea(field: Field, label: string, hint?: string) {
    return (
      <label style={{ display: "block" }}>
        {label}
        <textarea
          value={form[field]}
          onChange={(event) => update(field, event.target.value)}
          maxLength={5000}
          rows={4}
          style={inputStyle}
        />
        {hint && (
          <small
            style={{
              display: "block",
              marginTop: "6px",
              color: "#bbbbbb",
            }}
          >
            {hint}
          </small>
        )}
      </label>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 20px",
        background: "#080808",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
        lineHeight: 1.6,
      }}
    >
      <div style={{ maxWidth: "850px", margin: "0 auto" }}>
        <Link href="/filing-center" style={buttonStyle}>
          ← Filing Center
        </Link>

        <header style={{ margin: "32px 0" }}>
          <h1>Patent Preparation Organizer</h1>

          <p
            style={{
              color: "#67e8f9",
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            $24.99 per qualifying package
          </p>

          <p>
            Organize information about one invention, its development,
            supporting materials, and questions for a patent
            professional.
          </p>

          <p style={{ color: "#fde68a" }}>
            Draft preparation is available below. Checkout and paid
            PDF downloads are coming soon. No payment is collected
            on this page.
          </p>

          <p style={{ color: "#cccccc" }}>
            This organizer records information you provide. It does
            not include patent searches, patentability opinions,
            patent application or claim drafting, government filing,
            government fees, or legal representation. Package
            eligibility and scope will be explained before checkout
            becomes available.
          </p>
        </header>

        <section
          aria-label="Patent preparation form"
          style={{
            padding: "24px",
            border: "1px solid #444",
            borderRadius: "18px",
            background: "#151515",
          }}
        >
          <h2>Your invention draft</h2>

          <p style={{ color: "#cccccc" }}>
            You may save incomplete answers. This page stores one
            patent draft in this browser, separate from My
            Applications. Saving again replaces that browser draft.
            No form answers are uploaded by this page.
          </p>

          <p style={{ color: "#fde68a" }}>
            Browser storage is not a secure vault. Anyone using
            this browser profile may be able to access the draft.
            Avoid sensitive personal information and confidential
            technical details on a shared device.
          </p>

          {!ready ? (
            <p role="status">Loading your draft…</p>
          ) : (
            <form onSubmit={saveDraft}>
              <div style={{ display: "grid", gap: "22px" }}>
                {textField(
                  "packageTitle",
                  "Draft title",
                  "text",
                  "Choose a name to recognize this organizer."
                )}

                <h2 style={{ marginBottom: 0 }}>
                  Inventor information
                </h2>

                {textArea(
                  "inventorNames",
                  "Inventor names",
                  "List the people you believe contributed to the invention. This organizer does not determine legal inventorship."
                )}

                {textField(
                  "contactEmail",
                  "Contact email",
                  "email"
                )}

                <h2 style={{ marginBottom: 0 }}>
                  Invention overview
                </h2>

                {textField("inventionTitle", "Invention title")}

                {textField(
                  "inventionCategory",
                  "General field or category",
                  "text",
                  "Example: household equipment, manufacturing, or software."
                )}

                {textArea(
                  "problem",
                  "What problem does the invention address?"
                )}

                {textArea(
                  "description",
                  "Describe your invention",
                  "Use your own words to summarize the idea."
                )}

                {textArea(
                  "components",
                  "Main parts, materials, or process steps"
                )}

                {textArea(
                  "operation",
                  "How does it work?",
                  "Explain how the parts or steps work together."
                )}

                {textArea(
                  "differences",
                  "How do you believe it differs from existing solutions?",
                  "Record your observations. This is not a novelty or patentability assessment."
                )}

                {textArea(
                  "variations",
                  "Possible alternatives or variations",
                  "Describe other versions you have considered."
                )}

                <label>
                  Development stage
                  <select
                    value={form.developmentStatus}
                    onChange={(event) =>
                      update(
                        "developmentStatus",
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    <option value="">Select an option</option>
                    <option value="Idea or concept">
                      Idea or concept
                    </option>
                    <option value="Drawings or design">
                      Drawings or design
                    </option>
                    <option value="Prototype">
                      Prototype
                    </option>
                    <option value="Testing">
                      Testing
                    </option>
                    <option value="In production or use">
                      In production or use
                    </option>
                    <option value="Other">
                      Other
                    </option>
                  </select>
                </label>

                <h2 style={{ marginBottom: 0 }}>
                  Supporting information
                </h2>

                {textArea(
                  "drawingsNotes",
                  "Drawings, photos, and supporting records",
                  "List materials you already have. File uploads are not available yet."
                )}

                {textArea(
                  "disclosureHistory",
                  "Previous sharing, publication, offers for sale, or sales",
                  "If applicable, record what happened, when, and whether it was public or private. Leave uncertain dates marked as approximate."
                )}

                {textArea(
                  "existingApplications",
                  "Related applications or professional assistance",
                  "Record any application references or previous discussions you want a patent professional to review."
                )}

                {textArea(
                  "professionalQuestions",
                  "Questions for a patent professional"
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <button
                    type="submit"
                    disabled={!storageAvailable}
                    style={{
                      ...buttonStyle,
                      opacity: storageAvailable ? 1 : 0.5,
                      cursor: storageAvailable
                        ? "pointer"
                        : "not-allowed",
                    }}
                  >
                    Save Browser Draft
                  </button>

                  <button
                    type="button"
                    onClick={clearDraft}
                    style={{
                      ...buttonStyle,
                      background: "#7f1d1d",
                    }}
                  >
                    Delete Browser Draft
                  </button>
                </div>
              </div>
            </form>
          )}

          <p
            role="status"
            aria-live="polite"
            style={{ color: "#67e8f9" }}
          >
            {message}
          </p>

          {savedAt && (
            <p style={{ color: "#bbbbbb" }}>
              Last saved: {savedAt}
            </p>
          )}
        </section>

        <footer
          style={{
            marginTop: "28px",
            color: "#bbbbbb",
          }}
        >
          Saving this organizer does not file a patent application,
          establish a filing date, or create patent protection.
          Browser drafts may be lost if you clear browser data or
          use a different device or browser.
        </footer>
      </div>
    </main>
  );
} 
