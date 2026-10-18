"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

const LOCAL_DRAFT_KEY = "raysnotes-hawaii-llc-draft-v1";

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

function readForm(value: unknown): Draft {
  const result = { ...emptyForm };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }

  const source = value as Record<string, unknown>;

  for (const field of Object.keys(emptyForm) as Field[]) {
    if (typeof source[field] === "string") {
      result[field] = source[field] as string;
    }
  }

  return result;
}

export default function HawaiiLLCPage() {
  const [form, setForm] = useState<Draft>(emptyForm);
  const [applicationId, setApplicationId] = useState("");
  const [paid, setPaid] = useState(false);
  const [certified, setCertified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [localDraft, setLocalDraft] = useState<Draft | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("application_id");
      const sessionId = params.get("session_id");

      try {
        if (!id) {
          return;
        }

        const response = await fetch(
          `/api/llc-applications?application_id=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Your LLC application could not be loaded."
          );
        }

        if (!active) return;

        setApplicationId(result.application.id);
        setForm(readForm(result.application.form));
        setPaid(result.application.paid === true);

        try {
          const saved = localStorage.getItem(LOCAL_DRAFT_KEY);

          if (saved) {
            const restored = readForm(JSON.parse(saved));

            if (Object.values(restored).some((value) => value.trim())) {
              setLocalDraft(restored);
            }
          }
        } catch {
          // Account saving works independently of browser storage.
        }

        if (sessionId) {
          const verification = await fetch("/api/llc-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              applicationId: result.application.id,
              sessionId,
            }),
          });

          const payment = await verification.json();

          if (!verification.ok || payment.paid !== true) {
            throw new Error(
              payment.error ||
                "Payment could not be verified. If charged, do not pay again."
            );
          }

          if (!active) return;

          setPaid(true);
          setMessage("Payment verified for this LLC preparation package.");

          window.history.replaceState(
            {},
            "",
            `/filing-center/hawaii-llc?application_id=${encodeURIComponent(
              result.application.id
            )}`
          );
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error ? error.message : "Please try again."
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);

  function update(field: Field, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setCertified(false);
    setMessage("Unsaved changes. Click Save Draft.");
  }

  function importLocalDraft() {
    if (!localDraft) return;

    const confirmed = window.confirm(
      "Replace the answers currently shown with your earlier browser draft? " +
        "This will not change this application's payment. " +
        "Click Save Draft afterward to save the imported answers to your account."
    );

    if (!confirmed) return;

    setForm(localDraft);
    setDirty(true);
    setCertified(false);
    setMessage("Earlier draft imported. Click Save Draft to keep it.");
  }

  async function persistDraft() {
    if (!applicationId) {
      throw new Error("Open an LLC draft from My Applications first.");
    }

    const response = await fetch("/api/llc-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, form }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Your LLC draft could not be saved.");
    }

    setDirty(false);
  }

  async function saveDraft() {
    setBusy(true);
    setMessage("Saving your draft…");

    try {
      await persistDraft();
      setMessage("LLC draft saved to your account.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Save failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function purchase() {
    setBusy(true);
    setMessage("Saving your draft and opening checkout…");

    try {
      await persistDraft();

      const response = await fetch("/api/llc-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Checkout could not be opened.");
      }

      window.location.assign(result.url);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Checkout failed."
      );
      setBusy(false);
    }
  }

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!paid || !certified) {
      setMessage("Payment and review confirmation are required.");
      return;
    }

    setBusy(true);
    setMessage("Preparing your PDF…");

    try {
      await persistDraft();

      const response = await fetch("/api/llc-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          certified: true,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "PDF download failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "raysnotes-hawaii-llc-preparation.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 10000);

      setMessage("PDF download started. Check your Downloads folder.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Download failed."
      );
    } finally {
      setBusy(false);
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
          maxLength={field === "companyName" ? 300 : 500}
          {...(type === "number" ? { min: 1, step: 1 } : {})}
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
          <Link href="/my-applications">My Applications</Link>
        </nav>

        <header>
          <p className="eyebrow">HAWAII BUSINESS PREPARATION</p>
          <h1>Hawaii LLC Preparation Package</h1>
          <p>
            Organize your business information, save a draft in your
            account, and download a preparation summary and checklist.
          </p>
        </header>

        <section className="notice">
          <h2>Preparation service</h2>
          <p>
            This package organizes the information you provide.
            It does not submit Articles of Organization, form an LLC,
            reserve a business name, or include government fees.
            Ray&apos;sNotes does not provide legal or tax advice.
          </p>
          <p>
            You can save unfinished answers and return later.
            A preparation summary is not the official state form.
          </p>
        </section>

        {message && (
          <p className="message" role="status" aria-live="polite">
            {message}
          </p>
        )}

        {checking ? (
          <p>Loading your LLC application…</p>
        ) : !applicationId ? (
          <section className="card">
            <h2>Start or open your LLC draft</h2>
            <p>
              Sign in through My Applications, then choose
              Start Hawaii LLC Draft or open an existing LLC.
            </p>
            <Link href="/my-applications">Open My Applications</Link>
          </section>
        ) : (
          <>
            <section className="card payment">
              <h2>Preparation Package — $24.99</h2>
              <p>
                Includes an account-saved draft, downloadable
                preparation summary, and filing checklist.
              </p>

              {paid ? (
                <p className="success">
                  ✓ Preparation payment received for this LLC.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={purchase}
                  disabled={busy}
                >
                  Purchase Preparation — $24.99
                </button>
              )}

              <p>
                Your $24.99 preparation payment provides a one-time
                credit toward the $149 full-service fee for this
                same LLC. The remaining service charge would be
                $124.01, plus government fees.
              </p>

              <p>
                Full-service upgrade checkout is coming soon.
                Purchasing preparation does not submit a filing.
              </p>
            </section>

            {localDraft && (
              <section className="card">
                <h2>Earlier browser draft found</h2>
                <p>
                  You can import your earlier draft into this
                  application. Check that it belongs to this same LLC.
                </p>
                <button
                  type="button"
                  onClick={importLocalDraft}
                  disabled={busy}
                >
                  Import Earlier Draft
                </button>
              </section>
            )}

            <form onSubmit={download}>
              <fieldset disabled={busy}>
                <section className="card">
                  <h2>1. Company information</h2>
                  {input("companyName", "Proposed LLC name")}
                  <p className="hint">
                    Include an accepted LLC designation, such as LLC.
                    This page does not check or reserve the name.
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
                    Record the agent you intend to appoint and their
                    Hawaii business street address. This package does
                    not supply a registered agent.
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
                    Record your intended selection. Leave this blank
                    if unsure and seek legal advice before filing.
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
                  <h2>7. Save and download</h2>

                  <label className="confirmation">
                    <input
                      type="checkbox"
                      checked={certified}
                      onChange={(event) =>
                        setCertified(event.target.checked)
                      }
                    />
                    <span>
                      I have reviewed the answers provided. I
                      understand blank fields remain unfinished
                      and this summary is not a state filing.
                    </span>
                  </label>

                  <div className="actions">
                    <button type="button" onClick={saveDraft}>
                      Save Draft
                    </button>
                    <button
                      type="submit"
                      disabled={!paid || !certified}
                    >
                      Download Preparation PDF
                    </button>
                  </div>

                  <p>
                    {dirty
                      ? "You have unsaved changes."
                      : "Your draft is saved."}
                    {!paid && " Payment is required to download."}
                  </p>
                </section>
              </fieldset>
            </form>
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
        .container :global(a) {
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
          overflow-wrap: anywhere;
        }
        .eyebrow {
          color: #67e8f9;
          font-weight: 700;
          letter-spacing: 2px;
        }
        .notice,
        .card,
        .message {
          padding: 26px;
          margin: 24px 0;
          border: 1px solid #405371;
          border-radius: 16px;
          background: #14203a;
        }
        .notice {
          border-color: #e4a451;
        }
        .payment {
          border-color: #67e8f9;
        }
        .success {
          color: #a7f3d0;
          font-weight: 700;
        }
        .message {
          background: #243650;
        }
        fieldset {
          border: 0;
          padding: 0;
          margin: 0;
          min-width: 0;
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
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
        }
        .confirmation {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .confirmation input {
          width: 20px;
          height: 20px;
          margin: 3px 0;
          flex-shrink: 0;
        }
        footer {
          margin-top: 36px;
        }
        @media (max-width: 480px) {
          .notice,
          .card,
          .message {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
} 
