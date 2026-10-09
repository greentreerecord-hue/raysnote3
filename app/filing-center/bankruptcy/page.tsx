"use client";

import { useEffect, useState, type CSSProperties } from "react";

const PAYMENT_API = "/api/bankruptcy-organizer-payment";
const STORAGE_KEY = "raysnotes-bankruptcy-payment-session";

const fields = [
  { name: "name", label: "Full legal name", rows: 1 },
  { name: "address", label: "Mailing address", rows: 3 },
  {
    name: "household",
    label: "Household information",
    hint: "List household members and your marital status.",
    rows: 3,
  },
  {
    name: "income",
    label: "Income",
    hint: "List income sources, amounts, and payment frequency.",
    rows: 5,
  },
  {
    name: "expenses",
    label: "Monthly expenses",
    hint: "List housing, utilities, food, transportation, and other expenses.",
    rows: 5,
  },
  {
    name: "property",
    label: "Property and assets",
    hint: "List property you own and your estimated values.",
    rows: 5,
  },
  {
    name: "debts",
    label: "Debts and creditors",
    hint: "List creditor names, mailing addresses, and amounts owed.",
    rows: 7,
  },
  {
    name: "history",
    label: "Financial history and previous bankruptcy cases",
    hint: "Record information you want to discuss with an attorney.",
    rows: 5,
  },
  { name: "questions", label: "Questions for an attorney", rows: 4 },
];

const checklist = [
  "Income records",
  "Tax returns",
  "Bank statements",
  "Debt statements and creditor addresses",
  "Property and vehicle records",
  "Monthly expense records",
  "Previous bankruptcy documents, if applicable",
];

const buttonStyle: CSSProperties = {
  display: "inline-block",
  padding: "13px 18px",
  border: "2px solid white",
  borderRadius: "12px",
  background: "#2563eb",
  color: "white",
  fontSize: "16px",
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
};

function rememberPayment(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Access still works for this visit.
  }
}

export default function HawaiiBankruptcyPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sessionId, setSessionId] = useState("");
  const [paid, setPaid] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [codeMessage, setCodeMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedId = params.get("session_id");

    let savedId = "";

    try {
      savedId = localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      // Verification still works if storage is unavailable.
    }

    const id = returnedId || savedId;

    if (!id) {
      setVerifying(false);

      if (params.get("cancelled")) {
        setMessage("Checkout was cancelled. You can try again below.");
      }

      return;
    }

    let active = true;
    setSessionId(id);

    async function verify() {
      try {
        const response = await fetch(
          `${PAYMENT_API}?session_id=${encodeURIComponent(id)}`,
          {
            cache: "no-store",
            credentials: "same-origin",
          }
        );

        const data = await response.json();

        if (!response.ok || data.paid !== true) {
          throw new Error(
            data.error || "Payment could not be verified."
          );
        }

        if (!active) return;

        rememberPayment(id);
        setPaid(true);

        if (typeof data.recoveryCode === "string") {
          setRecoveryCode(data.recoveryCode);
        }

        setMessage("Payment verified. Your organizer is unlocked.");
      } catch (error) {
        if (active) {
          setShowRecovery(true);
          setMessage(
            error instanceof Error
              ? error.message
              : "Payment verification failed."
          );
        }
      } finally {
        if (active) setVerifying(false);
      }
    }

    void verify();

    return () => {
      active = false;
    };
  }, []);

  async function startCheckout() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(PAYMENT_API, {
        method: "POST",
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok || typeof data.url !== "string") {
        throw new Error(data.error || "Unable to open checkout.");
      }

      window.location.assign(data.url);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Checkout failed."
      );
      setBusy(false);
    }
  }

  async function recoverPurchase() {
    const code = recoveryInput.trim();

    if (!code) {
      setMessage("Paste your private recovery code first.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(PAYMENT_API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recover",
          recoveryCode: code,
        }),
      });

      const data = await response.json();

      if (
        !response.ok ||
        data.paid !== true ||
        typeof data.sessionId !== "string" ||
        typeof data.recoveryCode !== "string"
      ) {
        throw new Error(
          data.error || "Your purchase could not be recovered."
        );
      }

      setSessionId(data.sessionId);
      rememberPayment(data.sessionId);
      setRecoveryCode(data.recoveryCode);
      setPaid(true);
      setRecoveryInput("");
      setShowRecovery(false);
      setMessage(
        "Purchase recovered. You can create and download your organizer again."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Recovery failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryCode() {
    setCodeMessage("");

    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCodeMessage(
        "Recovery code copied. Save it somewhere private."
      );
    } catch {
      setCodeMessage(
        "Select the code below and copy it manually."
      );
    }
  }

  function saveRecoveryCode() {
    const text = [
      "Ray'sNotes Hawaii Bankruptcy Organizer",
      "",
      "PRIVATE RECOVERY CODE",
      recoveryCode,
      "",
      "Keep this code private. Anyone with it can unlock the organizer.",
      "",
      "Return to:",
      "https://www.raysnotes.com/filing-center/bankruptcy",
      "",
      "Choose Recover My Download and paste the complete code.",
      "Recovery restores paid access, not previously entered answers.",
    ].join("\n");

    const blob = new Blob([text], {
      type: "text/plain;charset=utf-8",
    });

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "raysnotes-private-recovery-code.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      60000
    );

    setCodeMessage(
      "Recovery code file download started. Keep the file private."
    );
  }

  async function downloadPdf() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/bankruptcy-organizer-pdf", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, answers, checked }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || "The PDF could not be created."
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "raysnotes-hawaii-bankruptcy-organizer.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(
        () => URL.revokeObjectURL(objectUrl),
        60000
      );

      setMessage(
        "Your PDF download is ready. Keep your copy secure."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Download failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="content">
        <a href="/filing-center" style={buttonStyle}>
          ← Back to Filing Center
        </a>

        <header>
          <h1>Hawaii Bankruptcy Preparation Organizer</h1>
          <p>
            Organize your household, income, expenses, property,
            and debt information.
          </p>
        </header>

        <section>
          <h2>What You Receive — $9.99</h2>
          <ul>
            <li>A questionnaire for organizing your information</li>
            <li>A checklist of records to gather</li>
            <li>A downloadable PDF containing your answers</li>
            <li>Links to official Hawaii bankruptcy court resources</li>
          </ul>
          <p>
            One-time payment. This organizer does not prepare official
            court forms, submit a bankruptcy case, or include legal
            advice or attorney representation. Official bankruptcy forms
            are available free from the U.S. Courts.
          </p>
          <p>
            Pay first, then enter your answers. Use the same browser
            to return from checkout. After payment, save your private
            recovery code for future access.
          </p>

          {verifying ? (
            <p role="status">Checking payment…</p>
          ) : !paid ? (
            <>
              <div className="actions">
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={busy}
                  onClick={startCheckout}
                >
                  {busy ? "Please wait…" : "Buy Organizer — $9.99"}
                </button>

                <button
                  type="button"
                  style={{
                    ...buttonStyle,
                    background: "#374151",
                  }}
                  disabled={busy}
                  aria-expanded={showRecovery}
                  aria-controls="purchase-recovery"
                  onClick={() =>
                    setShowRecovery((previous) => !previous)
                  }
                >
                  Recover My Download
                </button>
              </div>

              {showRecovery && (
                <div id="purchase-recovery" className="recovery">
                  <h3>Already Purchased?</h3>
                  <p>
                    Paste the private recovery code you saved after
                    paying. You do not need to pay again.
                  </p>
                  <p>
                    This restores access to create a new PDF.
                    Previously entered answers are not stored.
                  </p>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void recoverPurchase();
                    }}
                  >
                    <label htmlFor="recovery-input">
                      Private recovery code
                    </label>
                    <textarea
                      id="recovery-input"
                      rows={4}
                      maxLength={400}
                      value={recoveryInput}
                      disabled={busy}
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="off"
                      onChange={(event) =>
                        setRecoveryInput(event.target.value)
                      }
                    />

                    <button
                      type="submit"
                      style={buttonStyle}
                      disabled={busy || !recoveryInput.trim()}
                    >
                      {busy
                        ? "Please wait…"
                        : "Restore My Purchase"}
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <p>✓ Payment verified</p>
          )}

          {message && <p role="status">{message}</p>}
        </section>

        {paid && recoveryCode && (
          <section className="notice">
            <h2>Save Your Private Recovery Code</h2>
            <p>
              Use this code to unlock your purchased organizer if
              you change browsers or devices, or clear browser data.
            </p>
            <p>
              Keep it private. Anyone with this code can access the
              organizer. It does not restore your previous answers.
            </p>

            <label htmlFor="saved-recovery-code">
              Your recovery code
            </label>
            <textarea
              id="saved-recovery-code"
              rows={4}
              value={recoveryCode}
              readOnly
              spellCheck={false}
              onFocus={(event) => event.currentTarget.select()}
            />

            <div className="actions">
              <button
                type="button"
                style={buttonStyle}
                onClick={copyRecoveryCode}
              >
                Copy Recovery Code
              </button>
              <button
                type="button"
                style={buttonStyle}
                onClick={saveRecoveryCode}
              >
                Save Recovery Code File
              </button>
            </div>

            {codeMessage && <p role="status">{codeMessage}</p>}
          </section>
        )}

        <section>
          <h2>Official Hawaii Court Resources</h2>
          <div className="actions">
            <a
              href="https://www.hib.uscourts.gov/filing"
              target="_blank"
              rel="noopener noreferrer"
              style={buttonStyle}
            >
              Before Filing ↗
            </a>
            <a
              href="https://www.hib.uscourts.gov/chapter-7-filing-requirements"
              target="_blank"
              rel="noopener noreferrer"
              style={buttonStyle}
            >
              Chapter 7 Requirements ↗
            </a>
            <a
              href="https://www.hib.uscourts.gov/chapter-13-filing-requirements"
              target="_blank"
              rel="noopener noreferrer"
              style={buttonStyle}
            >
              Chapter 13 Requirements ↗
            </a>
          </div>
        </section>

        {paid && (
          <>
            <section className="notice">
              <h2>Your Information</h2>
              <p>
                Answers stay in this page until you request your PDF.
                Creating the PDF sends your answers to our server for
                processing. This feature does not save your answers
                to a database.
              </p>
              <p>
                Refreshing or closing this page clears your answers.
                Download your PDF before leaving.
              </p>
              <p>
                Do not enter Social Security numbers, account numbers,
                passwords, or financial documents.
              </p>
            </section>

            <section>
              <h2>Your Preparation Notes</h2>
              {fields.map((field) => (
                <div className="field" key={field.name}>
                  <label htmlFor={field.name}>{field.label}</label>
                  {"hint" in field && (
                    <p id={`${field.name}-hint`}>{field.hint}</p>
                  )}
                  <textarea
                    id={field.name}
                    rows={field.rows}
                    maxLength={10000}
                    value={answers[field.name] || ""}
                    aria-describedby={
                      "hint" in field
                        ? `${field.name}-hint`
                        : undefined
                    }
                    onChange={(event) =>
                      setAnswers((previous) => ({
                        ...previous,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </section>

            <section>
              <h2>Documents to Gather for Review</h2>
              <p>
                Keep your records in your own secure storage.
                This checklist does not replace court requirements.
              </p>
              {checklist.map((item) => (
                <label className="checklist-item" key={item}>
                  <input
                    type="checkbox"
                    checked={!!checked[item]}
                    onChange={(event) =>
                      setChecked((previous) => ({
                        ...previous,
                        [item]: event.target.checked,
                      }))
                    }
                  />
                  {item}
                </label>
              ))}
            </section>

            <section>
              <h2>Download Your Organizer</h2>
              <p>
                Your PDF includes your answers and checklist.
                Keep it secure because it may contain private information.
              </p>
              <button
                type="button"
                style={buttonStyle}
                disabled={busy}
                onClick={downloadPdf}
              >
                {busy ? "Creating PDF…" : "Download My PDF"}
              </button>
            </section>
          </>
        )}

        <footer>
          Ray&apos;sNotes preparation organizer — not filed with any court.
        </footer>
      </div>

      <style jsx>{`
        main {
          min-height: 100vh;
          padding: 32px 20px;
          background: #080808;
          color: white;
          font-family: Arial, sans-serif;
          line-height: 1.7;
        }
        .content {
          max-width: 900px;
          margin: 0 auto;
        }
        header {
          margin: 36px 0;
        }
        h1 {
          font-size: clamp(30px, 6vw, 46px);
          line-height: 1.2;
        }
        section {
          margin: 28px 0;
          padding: 24px;
          border: 1px solid #444;
          border-radius: 16px;
          background: #151515;
        }
        p {
          color: #d1d5db;
        }
        .notice {
          border-color: #60a5fa;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
        }
        .recovery {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #555;
        }
        .field {
          margin: 24px 0;
        }
        label {
          display: block;
          font-weight: bold;
        }
        .field label {
          font-size: 18px;
        }
        textarea {
          box-sizing: border-box;
          width: 100%;
          padding: 12px;
          margin: 8px 0 16px;
          border: 1px solid #777;
          border-radius: 8px;
          background: #080808;
          color: white;
          font: inherit;
          resize: vertical;
          overflow-wrap: anywhere;
        }
        textarea:focus-visible,
        button:focus-visible,
        a:focus-visible {
          outline: 3px solid #60a5fa;
          outline-offset: 3px;
        }
        .checklist-item {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin: 12px 0;
          font-weight: normal;
        }
        button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        footer {
          margin: 32px 0;
          color: #ccc;
        }
      `}</style>
    </main>
  );
} 
