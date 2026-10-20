"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

const STORAGE_KEY = "raysnotes-trademark-draft-v1";

const initialForm = {
  packageTitle: "",
  ownerName: "",
  ownerType: "",
  email: "",
  mailingAddress: "",
  markType: "",
  brandName: "",
  logoDescription: "",
  goodsServices: "",
  useStatus: "",
  firstUseDate: "",
  website: "",
  supportingNotes: "",
};

type TrademarkForm = typeof initialForm;
type Field = keyof TrademarkForm;

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

export default function TrademarkPreparationPage() {
  const [form, setForm] = useState<TrademarkForm>(initialForm);
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
    if (!window.confirm("Delete this browser's trademark draft?")) {
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
          <small style={{ display: "block", marginTop: "6px", color: "#bbb" }}>
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
          <small style={{ display: "block", marginTop: "6px", color: "#bbb" }}>
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
          <h1>Trademark Preparation Package</h1>

          <p style={{ color: "#67e8f9", fontSize: "24px", fontWeight: 700 }}>
            $24.99 per qualifying package
          </p>

          <p>
            Organize information about one proposed brand name or logo
            and its associated products or services.
          </p>

          <p style={{ color: "#fde68a" }}>
            Draft preparation is available below. Checkout and paid
            PDF downloads are coming soon. No payment is collected
            on this page.
          </p>

          <p style={{ color: "#cccccc" }}>
            This package organizes information you provide. It does
            not include trademark searches, legal advice, application
            filing, government fees, or legal representation.
            It does not determine trademark eligibility or guarantee
            registration. Package eligibility and scope will be
            explained before checkout becomes available.
          </p>
        </header>

        <section
          aria-label="Trademark preparation form"
          style={{
            padding: "24px",
            border: "1px solid #444",
            borderRadius: "18px",
            background: "#151515",
          }}
        >
          <h2>Your preparation draft</h2>

          <p style={{ color: "#cccccc" }}>
            You may save incomplete answers. This page stores one
            trademark draft in this browser, separate from My
            Applications. Saving again replaces that browser draft.
            Avoid entering Social Security numbers, payment details,
            or confidential information.
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
                  "Example: Ray’sStream brand preparation"
                )}

                <h2 style={{ marginBottom: 0 }}>Owner information</h2>

                {textField("ownerName", "Owner’s legal name")}

                <label>
                  Owner type
                  <select
                    value={form.ownerType}
                    onChange={(event) =>
                      update("ownerType", event.target.value)
                    }
                    style={inputStyle}
                  >
                    <option value="">Select an option</option>
                    <option value="Individual">Individual</option>
                    <option value="LLC">LLC</option>
                    <option value="Corporation">Corporation</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Other or unsure">Other or unsure</option>
                  </select>
                </label>

                {textField("email", "Contact email", "email")}
                {textArea("mailingAddress", "Mailing address")}

                <h2 style={{ marginBottom: 0 }}>Brand information</h2>

                <label>
                  What are you preparing?
                  <select
                    value={form.markType}
                    onChange={(event) =>
                      update("markType", event.target.value)
                    }
                    style={inputStyle}
                  >
                    <option value="">Select an option</option>
                    <option value="Brand name or words">
                      Brand name or words
                    </option>
                    <option value="Logo or design">Logo or design</option>
                    <option value="Words and design">
                      Words and design
                    </option>
                    <option value="Unsure">Unsure</option>
                  </select>
                </label>

                {textField(
                  "brandName",
                  "Brand name or wording",
                  "text",
                  "Enter the wording exactly as you use or plan to use it."
                )}

                {textArea(
                  "logoDescription",
                  "Logo or design description",
                  "Describe the design, if applicable. File uploads are not available yet."
                )}

                {textArea(
                  "goodsServices",
                  "Products or services associated with the brand",
                  "Describe what customers buy or receive under this brand."
                )}

                <label>
                  Current use
                  <select
                    value={form.useStatus}
                    onChange={(event) =>
                      update("useStatus", event.target.value)
                    }
                    style={inputStyle}
                  >
                    <option value="">Select an option</option>
                    <option value="Currently using the brand">
                      Currently using the brand
                    </option>
                    <option value="Planning to use the brand">
                      Planning to use the brand
                    </option>
                    <option value="Unsure">Unsure</option>
                  </select>
                </label>

                {textField(
                  "firstUseDate",
                  "First-use date, if known",
                  "date",
                  "Leave blank if the brand has not been used or you are unsure."
                )}

                {textField(
                  "website",
                  "Website or store link",
                  "url",
                  "Include https:// if entering a link."
                )}

                {textArea(
                  "supportingNotes",
                  "Supporting materials and questions",
                  "Describe materials you already have and questions for a trademark professional."
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
                      cursor: storageAvailable ? "pointer" : "not-allowed",
                    }}
                  >
                    Save Browser Draft
                  </button>

                  <button
                    type="button"
                    onClick={clearDraft}
                    style={{ ...buttonStyle, background: "#7f1d1d" }}
                  >
                    Delete Browser Draft
                  </button>
                </div>
              </div>
            </form>
          )}

          <p role="status" aria-live="polite" style={{ color: "#67e8f9" }}>
            {message}
          </p>

          {savedAt && (
            <p style={{ color: "#bbbbbb" }}>
              Last saved: {savedAt}
            </p>
          )}
        </section>

        <footer style={{ marginTop: "28px", color: "#bbbbbb" }}>
          Saving this draft does not submit an application or
          reserve a trademark. Browser drafts may be lost if you
          clear browser data or use a different device or browser.
        </footer>
      </div>
    </main>
  );
} 
