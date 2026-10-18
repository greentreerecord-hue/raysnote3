"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "raysnotes-hawaii-llc-draft-v1";

const emptyForm = {
  companyName: "",
  mailingAddress: "",
  officeAddress: "",
  agentType: "",
  agentName: "",
  agentJurisdiction: "",
  agentAddress: "",
  organizers: "",
  duration: "",
  endDate: "",
  management: "",
  memberCount: "",
  managers: "",
  members: "",
  liability: "",
  liabilityDetails: "",
  contactName: "",
  email: "",
  phone: "",
  notes: "",
};

type Draft = typeof emptyForm;
type Field = keyof Draft;

export default function HawaiiLLCPage() {
  const [form, setForm] = useState<Draft>(emptyForm);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          throw new Error("Invalid draft");
        }

        const values = parsed as Record<string, unknown>;
        const restored = { ...emptyForm };

        for (const key of Object.keys(emptyForm) as Field[]) {
          if (typeof values[key] === "string") {
            restored[key] = values[key] as string;
          }
        }

        setForm(restored);
        setMessage("Your saved draft has been restored.");
      }
    } catch {
      setMessage(
        "Your draft could not be restored. Browser storage may be unavailable."
      );
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(field: Field, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setMessage("Unsaved changes. Click Save Draft.");
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      setDirty(false);
      setMessage("Draft saved on this device and browser.");
    } catch {
      setMessage(
        "Save failed. Browser storage may be unavailable or full."
      );
    }
  }

  function input(field: Field, label: string, type = "text") {
    return (
      <label>
        {label}
        <input
          type={type}
          value={form[field]}
          onChange={(event) => update(field, event.target.value)}
          maxLength={500}
        />
      </label>
    );
  }

  function area(field: Field, label: string) {
    return (
      <label>
        {label}
        <textarea
          value={form[field]}
          onChange={(event) => update(field, event.target.value)}
          rows={4}
          maxLength={10000}
        />
      </label>
    );
  }

  function select(field: Field, label: string, options: string[]) {
    return (
      <label>
        {label}
        <select
          value={form[field]}
          onChange={(event) => update(field, event.target.value)}
        >
          <option value="">Choose when ready</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <nav>
          <Link href="/filing-center">← Filing Center</Link>
          <Link href="/">Ray&apos;sNotes Home</Link>
        </nav>

        <header>
          <p className="eyebrow">HAWAII BUSINESS PREPARATION</p>
          <h1>Hawaii LLC Preparation</h1>
          <p>
            Organize your information for a new Hawaii limited
            liability company. Start a draft and return to finish.
          </p>
          <span className="badge">
            Preparation preview — filing service coming soon
          </span>
        </header>

        <section className="notice">
          <h2>About this draft</h2>
          <p>
            This page saves one draft on this device and browser.
            It is not saved to your Ray&apos;sNotes account.
            Clearing browser data can remove it. Avoid saving
            personal information on a shared device.
          </p>
          <p>
            Saving this draft does not register a business or send
            information to Hawaii. Payment and filing submission
            are not available on this page yet.
          </p>
          <p>
            Ray&apos;sNotes does not provide legal or tax advice.
            Leave any answer you are unsure about blank while
            preparing your draft.
          </p>
        </section>

        {!ready ? (
          <p>Loading your draft…</p>
        ) : (
          <>
            <section className="card">
              <h2>1. Company information</h2>
              {input("companyName", "Proposed LLC name")}
              <p className="hint">
                Include an accepted LLC designation, such as LLC.
                Entering a name here does not check or reserve it.
              </p>
              {area(
                "mailingAddress",
                "Principal office mailing address — include country and ZIP code"
              )}
              {area(
                "officeAddress",
                "Principal office physical address, if different"
              )}
            </section>

            <section className="card">
              <h2>2. Registered agent</h2>
              <p>
                Hawaii requires a registered agent with a business
                street address in Hawaii. This preview does not
                provide a registered agent.
              </p>
              {select("agentType", "Agent type", [
                "Individual",
                "Entity",
              ])}
              {input("agentName", "Agent’s full legal name")}
              {form.agentType === "Entity" &&
                input(
                  "agentJurisdiction",
                  "Entity’s state or country of formation"
                )}
              {area(
                "agentAddress",
                "Agent’s Hawaii business street address"
              )}
            </section>

            <section className="card">
              <h2>3. Organizers</h2>
              {area(
                "organizers",
                "Each organizer’s legal name, individual or entity type, and complete address"
              )}
            </section>

            <section className="card">
              <h2>4. Duration and management</h2>
              {select("duration", "Company duration", [
                "At-will",
                "Specified term",
              ])}

              {form.duration === "Specified term" &&
                input("endDate", "Term expiration date", "date")}

              {select("management", "Management structure", [
                "Member-managed",
                "Manager-managed",
              ])}

              {form.management === "Manager-managed" && (
                <>
                  {input(
                    "memberCount",
                    "Number of initial members",
                    "number"
                  )}
                  {area(
                    "managers",
                    "Each initial manager’s legal name, individual or entity type, and complete address"
                  )}
                </>
              )}

              {area(
                "members",
                form.management === "Manager-managed"
                  ? "Initial member names, types, and addresses (optional for manager-managed companies)"
                  : "Each initial member’s legal name, individual or entity type, and complete address"
              )}
            </section>

            <section className="card">
              <h2>5. Member liability selection</h2>
              <p>
                Record your intended selection from Form LLC-1.
                If unsure, leave this blank and seek legal advice
                before filing.
              </p>
              {select("liability", "Intended selection", [
                "Members shall not be liable for company debts, obligations, and liabilities",
                "Members shall be liable for all company debts, obligations, and liabilities",
                "Members shall be liable for specified debts, obligations, and liabilities",
              ])}
              {area(
                "liabilityDetails",
                "Details and written-consent notes, if applicable"
              )}
            </section>

            <section className="card">
              <h2>6. Contact information</h2>
              {input("contactName", "Contact name")}
              {input("email", "Contact email", "email")}
              {input("phone", "Contact phone", "tel")}
              {area("notes", "Questions or additional notes")}
              <p className="hint">
                Do not enter Social Security numbers, payment
                card details, or passwords.
              </p>
            </section>

            <section className="card">
              <h2>Save your preparation draft</h2>
              <p>
                You can save with unfinished fields and return
                using the same browser.
              </p>
              <button type="button" onClick={saveDraft}>
                Save Draft
              </button>
              <p role="status" aria-live="polite">
                {message || "Your draft is ready to edit."}
              </p>
            </section>
          </>
        )}

        <footer>
          <a
            href="https://cca.hawaii.gov/breg/registration/dllc/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hawaii official LLC registration resources ↗
          </a>
          <p>
            Review the current state form and instructions before
            filing. The state determines whether a filing is accepted.
          </p>
        </footer>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 32px 18px 70px;
          background: #080f24;
          color: #edf2ff;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 960px;
          margin: auto;
        }

        nav {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
        }

        nav :global(a),
        footer a {
          color: #67e8f9;
        }

        header {
          padding: 34px 0 12px;
        }

        h1 {
          font-size: clamp(32px, 6vw, 52px);
          margin: 16px 0;
        }

        h2 {
          margin-top: 0;
        }

        p {
          line-height: 1.7;
        }

        .eyebrow {
          color: #67e8f9;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .badge {
          display: inline-block;
          padding: 10px 14px;
          border-radius: 10px;
          background: #243650;
          color: #a5f3fc;
          line-height: 1.5;
        }

        .notice,
        .card {
          padding: 26px;
          margin: 24px 0;
          border: 1px solid #405371;
          border-radius: 16px;
          background: #14203a;
        }

        .notice {
          border-color: #e4a451;
        }

        label {
          display: block;
          margin: 20px 0;
          font-weight: 700;
          line-height: 1.6;
        }

        input,
        select,
        textarea {
          display: block;
          width: 100%;
          box-sizing: border-box;
          margin-top: 9px;
          padding: 13px;
          border: 1px solid #71829e;
          border-radius: 8px;
          background: #080f24;
          color: white;
          font: inherit;
          color-scheme: dark;
        }

        textarea {
          resize: vertical;
        }

        .hint {
          color: #c3cfe3;
          font-size: 14px;
        }

        button {
          padding: 14px 22px;
          border: 0;
          border-radius: 10px;
          background: #67e8f9;
          color: #082033;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        button:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: 3px solid #67e8f9;
          outline-offset: 3px;
        }

        footer {
          margin-top: 36px;
          color: #c3cfe3;
        }

        @media (max-width: 480px) {
          .notice,
          .card {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
} 
