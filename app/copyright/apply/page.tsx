"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

const emptyApplication = {
  workType: "Music and lyrics",
  title: "",
  authorName: "",
  pseudonym: "",
  claimantName: "",
  citizenship: "",
  creationYear: "",
  workForHire: "No",
  published: "No",
  publicationDate: "",
  publicationCountry: "",
  previousRegistration: "No",
  previousNumber: "",
  preexistingMaterial: "",
  newMaterial: "",
  email: "",
  phone: "",
  address: "",
};

type ApplicationData = typeof emptyApplication;
type Field = keyof ApplicationData;

export default function AssistedCopyrightApplicationPage() {
  const [form, setForm] = useState<ApplicationData>(emptyApplication);
  const [applicationId, setApplicationId] = useState("");
  const [certified, setCertified] = useState(false);
  const [message, setMessage] = useState("");
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("application_id");
      const sessionId = params.get("session_id");

      if (!id) {
        window.location.replace("/my-applications");
        return;
      }

      try {
        const response = await fetch(
          `/api/my-applications?application_id=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );

        if (response.status === 401) {
          window.location.replace("/my-applications");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Application could not be loaded.");
        }

        if (!active) return;

        setApplicationId(id);
        setForm({ ...emptyApplication, ...result.application.form });
        setPaid(result.application.paid);

        if (sessionId) {
          const verification = await fetch("/api/application-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ applicationId: id, sessionId }),
          });

          const payment = await verification.json();

          if (!verification.ok || !payment.paid) {
            throw new Error(
              payment.error ||
                "Payment could not be verified. Do not pay again."
            );
          }

          if (!active) return;

          setPaid(true);
          setMessage("Payment verified for this application.");

          window.history.replaceState(
            {},
            "",
            `/copyright/apply?application_id=${encodeURIComponent(id)}`
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
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(field: Field, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setMessage("Unsaved changes. Click Save Draft to keep them.");
  }

  async function persistDraft() {
    if (!applicationId) {
      throw new Error("Open an application from My Applications first.");
    }

    const response = await fetch("/api/my-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, form }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Your draft could not be saved.");
    }

    setDirty(false);
  }

  async function saveDraft() {
    setBusy(true);
    setMessage("Saving your draft…");

    try {
      await persistDraft();
      setMessage("Draft saved to your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function purchase() {
    setBusy(true);
    setMessage("Saving your draft and opening checkout…");

    try {
      await persistDraft();

      const response = await fetch("/api/application-checkout", {
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
      setMessage("Payment and your accuracy confirmation are required.");
      return;
    }

    setBusy(true);
    setMessage("Preparing your PDF…");

    try {
      await persistDraft();

      const response = await fetch("/api/application-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, certified: true }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Your PDF could not be downloaded.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "raysnotes-copyright-application-summary.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);

      setMessage("PDF downloaded. Check your Downloads folder.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Download failed."
      );
    } finally {
      setBusy(false);
    }
  }

  function input(
    field: Field,
    label: string,
    required = true,
    type = "text"
  ) {
    return (
      <label key={field}>
        {label}
        <input
          type={type}
          value={form[field]}
          onChange={(event) => update(field, event.target.value)}
          maxLength={field === "title" ? 300 : 5000}
          required={required}
          {...(type === "number" ? { min: 1900, max: 2100 } : {})}
        />
      </label>
    );
  }

  function select(field: Field, label: string, options: string[]) {
    return (
      <label key={field}>
        {label}
        <select
          value={form[field]}
          onChange={(event) => update(field, event.target.value)}
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  function textArea(field: Field, label: string, required = false) {
    return (
      <label key={field}>
        {label}
        <textarea
          value={form[field]}
          onChange={(event) => update(field, event.target.value)}
          maxLength={5000}
          rows={4}
          required={required}
        />
      </label>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <nav>
          <Link href="/my-applications">← My Applications</Link>
          <Link href="/copyright">Copyright Center</Link>
        </nav>

        <header>
          <p className="eyebrow">GUIDED APPLICATION PREPARATION</p>
          <h1>Assisted Copyright Application</h1>
          <p>Prepare and save a separate summary for each work.</p>
        </header>

        <section className="notice">
          <h2>Before you begin</h2>
          <p>
            This service prepares information only. It does not file an
            application, provide legal advice, guarantee registration, or
            include the U.S. Copyright Office filing fee.
          </p>
        </section>

        {message && <p className="message" role="status">{message}</p>}

        {checking ? (
          <p>Loading your application…</p>
        ) : !applicationId ? (
          <section className="card">
            <p>Return to My Applications to open your saved work.</p>
            <Link href="/my-applications">My Applications</Link>
          </section>
        ) : (
          <>
            <section className={`payment ${paid ? "paymentPaid" : ""}`}>
              <h2>Assisted Application — $24.99</h2>
              {paid ? (
                <p>✓ Payment received for this application.</p>
              ) : (
                <>
                  <p>
                    Save your draft now. Payment unlocks this application’s
                    downloadable summary.
                  </p>
                  <button type="button" disabled={busy} onClick={purchase}>
                    Purchase Assisted Application — $24.99
                  </button>
                </>
              )}
            </section>

            <form onSubmit={download}>
              <fieldset disabled={busy}>
                <section className="card">
                  <h2>1. Work information</h2>
                  <div className="grid">
                    {select("workType", "Type of work", [
                      "Music and lyrics",
                      "Sound recording",
                      "Writing or literary work",
                      "Photograph",
                      "Visual artwork",
                      "Video or motion picture",
                      "Software or computer program",
                      "Other",
                    ])}
                    {input("title", "Title of the work")}
                    {input("creationYear", "Year completed", true, "number")}
                    {select("published", "Has the work been published?", [
                      "No", "Yes", "Not sure",
                    ])}
                    {form.published === "Yes" && (
                      <>
                        {input("publicationDate", "Date first published", true, "date")}
                        {input("publicationCountry", "Country first published")}
                      </>
                    )}
                  </div>
                </section>

                <section className="card">
                  <h2>2. Author and claimant</h2>
                  <div className="grid">
                    {input("authorName", "Author’s full legal name")}
                    {input("pseudonym", "Pseudonym or stage name (optional)", false)}
                    {input("claimantName", "Copyright claimant’s legal name")}
                    {input("citizenship", "Author’s citizenship or domicile")}
                    {select("workForHire", "Work made for hire?", [
                      "No", "Yes", "Not sure",
                    ])}
                  </div>
                </section>

                <section className="card">
                  <h2>3. Previous and new material</h2>
                  <div className="grid">
                    {select("previousRegistration", "Previously registered?", [
                      "No", "Yes", "Not sure",
                    ])}
                    {form.previousRegistration === "Yes" &&
                      input("previousNumber", "Previous registration number")}
                  </div>
                  {textArea("preexistingMaterial", "Preexisting material excluded (if any)")}
                  {textArea("newMaterial", "New material included in this claim")}
                </section>

                <section className="card">
                  <h2>4. Contact information</h2>
                  <div className="grid">
                    {input("email", "Email", true, "email")}
                    {input("phone", "Phone (optional)", false, "tel")}
                  </div>
                  {textArea("address", "Mailing address", true)}
                </section>

                <section className="card">
                  <h2>5. Review and download</h2>
                  <label className="confirmation">
                    <input
                      type="checkbox"
                      checked={certified}
                      onChange={(event) => setCertified(event.target.checked)}
                    />
                    <span>
                      I have reviewed my answers and confirm they are accurate
                      to the best of my knowledge.
                    </span>
                  </label>

                  <div className="actions">
                    <button type="button" onClick={saveDraft}>
                      Save Draft
                    </button>
                    <button type="submit" disabled={!paid || !certified}>
                      Download PDF Summary
                    </button>
                  </div>

                  <p>
                    {dirty ? "You have unsaved changes." : "Your draft is saved."}
                    {!paid && " Payment is required to download."}
                  </p>
                </section>
              </fieldset>
            </form>
          </>
        )}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 32px 18px 70px;
          background: #080f24;
          color: #edf2ff;
        }
        .container { max-width: 1100px; margin: auto; }
        nav { display: flex; flex-wrap: wrap; gap: 24px; }
        header { padding: 32px 0; }
        h1 { font-size: clamp(30px, 5vw, 48px); margin: 12px 0; }
        h2 { margin-top: 0; }
        p { line-height: 1.6; }
        .eyebrow { color: #67e8f9; letter-spacing: 2px; }
        .notice, .card, .payment {
          padding: 26px;
          border-radius: 16px;
          margin: 22px 0;
          background: #14203a;
          border: 1px solid #405371;
        }
        .notice { border-color: #e4a451; }
        .payment { text-align: center; border-color: #38bdf8; }
        .paymentPaid { border-color: #34d399; }
        .message {
          padding: 18px;
          background: #243650;
          border-radius: 10px;
          overflow-wrap: anywhere;
        }
        fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }
        label { display: block; margin: 12px 0; font-weight: 600; }
        input, select, textarea {
          display: block;
          width: 100%;
          box-sizing: border-box;
          padding: 13px;
          margin-top: 9px;
          border-radius: 8px;
          border: 1px solid #71829e;
          background: #080f24;
          color: white;
          font: inherit;
          color-scheme: dark;
        }
        textarea { resize: vertical; }
        button {
          padding: 14px 20px;
          border: 0;
          border-radius: 10px;
          background: #67e8f9;
          color: #082033;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .actions { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 24px; }
        .confirmation { display: flex; align-items: flex-start; gap: 12px; }
        .confirmation input { width: 20px; height: 20px; margin: 2px 0; flex-shrink: 0; }
      `}</style>
    </main>
  );
} 
