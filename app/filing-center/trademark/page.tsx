"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LOCAL_DRAFT_KEY = "raysnotes-trademark-draft-v1";

const emptyForm = {
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

type Draft = typeof emptyForm;
type Field = keyof Draft;

type Application = {
  id: string;
  title: string;
  paid: boolean;
  updatedAt: string;
};

function readForm(value: unknown): Draft {
  const form = { ...emptyForm };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return form;
  }

  const source = value as Record<string, unknown>;

  for (const field of Object.keys(emptyForm) as Field[]) {
    const value = source[field];

    if (typeof value === "string") {
      form[field] = value.slice(
        0,
        field === "packageTitle" ? 300 : 5000
      );
    }
  }

  return form;
}

export default function TrademarkPage() {
  const [form, setForm] = useState<Draft>({ ...emptyForm });
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [paid, setPaid] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [paymentUnresolved, setPaymentUnresolved] = useState(false);
  const [message, setMessage] = useState("");
  const [localDraft, setLocalDraft] = useState<Draft | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("application_id");
      const sessionId = params.get("session_id");

      if (sessionId && active) {
        setPaymentUnresolved(true);
      }

      try {
        try {
          const saved = localStorage.getItem(LOCAL_DRAFT_KEY);

          if (saved && active) {
            const restored = readForm(JSON.parse(saved));

            if (Object.values(restored).some((value) => value.trim())) {
              setLocalDraft(restored);
            }
          }
        } catch {
          // Account drafts work independently of browser storage.
        }

        const response = await fetch(
          "/api/trademark-applications",
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!active) return;

        if (response.status === 401) {
          setMessage(
            "Sign in through My Applications, then return to this page."
          );
          return;
        }

        if (!response.ok) {
          throw new Error(result.error || "Drafts could not be loaded.");
        }

        setSignedIn(true);
        setApplications(result.applications || []);

        if (sessionId && !id) {
          throw new Error(
            "The payment return link is missing its draft reference. If charged, do not pay again."
          );
        }

        if (!id) return;

        const draftResponse = await fetch(
          `/api/trademark-applications?application_id=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );

        const draftResult = await draftResponse.json();

        if (!draftResponse.ok) {
          throw new Error(
            draftResult.error || "Your trademark draft could not be loaded."
          );
        }

        if (!active) return;

        setApplicationId(draftResult.application.id);
        setForm(readForm(draftResult.application.form));
        setPaid(draftResult.application.paid === true);

        if (sessionId) {
          const paymentResponse = await fetch(
            `/api/trademark-payment?application_id=${encodeURIComponent(id)}` +
              `&session_id=${encodeURIComponent(sessionId)}`,
            { cache: "no-store" }
          );

          const payment = await paymentResponse.json();

          if (!paymentResponse.ok || payment.paid !== true) {
            throw new Error(
              payment.error ||
                payment.message ||
                "Payment could not be verified. If charged, do not pay again."
            );
          }

          if (!active) return;

          setPaid(true);
          setPaymentUnresolved(false);
          setMessage("Your $24.99 trademark preparation payment is confirmed.");

          const url = new URL(window.location.href);
          url.searchParams.delete("session_id");

          window.history.replaceState(
            {},
            "",
            `${url.pathname}${url.search}${url.hash}`
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
    setReviewed(false);
    setAcknowledged(false);
    setMessage("Unsaved changes. Click Save Draft.");
  }

  function importBrowserDraft() {
    if (!localDraft || busy) return;

    if (
      !window.confirm(
        "Replace the answers shown with your earlier browser draft? " +
          "Import only if it belongs to this same trademark. " +
          "Click Save Draft afterward."
      )
    ) {
      return;
    }

    setForm({ ...localDraft });
    setDirty(true);
    setReviewed(false);
    setAcknowledged(false);
    setMessage(
      "Browser draft imported. Click Save Draft to save it to your account."
    );
  }

  async function persistDraft() {
    const response = await fetch("/api/trademark-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: applicationId || undefined,
        form,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.application?.id) {
      throw new Error(result.error || "Your draft could not be saved.");
    }

    const saved = result.application;

    setApplicationId(saved.id);
    setPaid(saved.paid === true);
    setDirty(false);

    setApplications((current) => [
      saved,
      ...current.filter((item) => item.id !== saved.id),
    ]);

    const url = new URL(window.location.href);
    url.searchParams.set("application_id", saved.id);

    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );

    return saved.id as string;
  }

  async function saveDraft() {
    if (busy) return;

    setBusy(true);
    setMessage("Saving your draft…");

    try {
      await persistDraft();
      setMessage("Trademark draft saved to your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (busy || paid || paymentUnresolved || !acknowledged) return;

    setBusy(true);
    setMessage("Saving your draft and opening checkout…");

    try {
      const id = await persistDraft();

      const response = await fetch("/api/trademark-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id }),
      });

      const result = await response.json();

      if (!response.ok || typeof result.url !== "string") {
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

  async function download() {
    if (busy || !paid || !reviewed) return;

    setBusy(true);
    setMessage("Preparing your PDF…");

    try {
      const id = await persistDraft();

      const response = await fetch(
        `/api/trademark-pdf?application_id=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "PDF download failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "raysnotes-trademark-preparation.pdf";
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
          maxLength={field === "packageTitle" ? 300 : 500}
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
          maxLength={5000}
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
          <Link href="/my-applications">My Applications / Sign In</Link>
        </nav>

        <header>
          <p className="eyebrow">TRADEMARK PREPARATION</p>
          <h1>Trademark Preparation Package</h1>
          <p>
            Save information about your proposed brand in your account.
            Purchase the preparation summary and checklist for $24.99.
          </p>
        </header>

        <section className="notice">
          <h2>What this package includes</h2>
          <p>
            One package organizes one proposed brand name or logo and
            its associated products or services. You may save incomplete
            answers. Blank answers remain unfinished in the PDF.
          </p>
          <p>
            Package qualification concerns this preparation scope only.
            It does not determine whether a trademark can be registered.
          </p>
          <p>
            Searches, legal opinions, government filing, government fees,
            and legal representation are not included. Ray&apos;sNotes
            does not provide legal advice. Payment does not register a
            trademark, reserve a name, or guarantee approval.
          </p>
        </section>

        {message && (
          <p className="message" role="status" aria-live="polite">
            {message}
          </p>
        )}

        {checking ? (
          <p>Loading your trademark drafts…</p>
        ) : !signedIn ? (
          <section className="card">
            <h2>Sign in to save and purchase</h2>
            <p>
              Open My Applications to sign in or create an account,
              then return to this trademark page.
            </p>
            <Link href="/my-applications">Open My Applications</Link>
          </section>
        ) : (
          <>
            {paymentUnresolved && (
              <section className="notice">
                <h2>Payment verification needs attention</h2>
                <p>
                  Checkout is paused to prevent another payment.
                  Refresh to retry verification. If charged, do not
                  pay again. Save any edited answers before refreshing.
                </p>
              </section>
            )}

            <section className="card">
              <h2>Your trademark drafts</h2>
              <p>
                Open saved trademark drafts here. This list shows your
                100 most recently updated trademark drafts.
              </p>

              <ul>
                {applications.map((application) => (
                  <li key={application.id}>
                    <a
                      href={
                        "/filing-center/trademark?application_id=" +
                        encodeURIComponent(application.id)
                      }
                      onClick={(event) => {
                        if (
                          busy ||
                          paymentUnresolved ||
                          (dirty &&
                            !window.confirm(
                              "Leave without saving your changes?"
                            ))
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      {application.title}
                    </a>
                    {" — "}
                    {application.paid ? "Paid" : "Not paid"}
                  </li>
                ))}
              </ul>

              {applications.length === 0 && (
                <p>
                  No account drafts yet. Complete any answers below
                  and click Save Draft to create one.
                </p>
              )}

              {applicationId && (
                <a
                  href="/filing-center/trademark"
                  onClick={(event) => {
                    if (
                      busy ||
                      paymentUnresolved ||
                      (dirty &&
                        !window.confirm(
                          "Leave without saving your changes?"
                        ))
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  Start a new trademark draft
                </a>
              )}
            </section>

            {localDraft && (
              <section className="card">
                <h2>Earlier browser draft found</h2>
                <p>
                  Import it if it belongs to the trademark you are
                  preparing. Your browser copy remains available.
                </p>
                <button
                  type="button"
                  onClick={importBrowserDraft}
                  disabled={busy}
                >
                  Import Browser Draft
                </button>
              </section>
            )}

            <form onSubmit={(event) => event.preventDefault()}>
              <fieldset disabled={busy}>
                <section className="card">
                  <h2>1. Owner information</h2>
                  {input("packageTitle", "Draft title")}
                  {input("ownerName", "Owner's legal name")}
                  {select("ownerType", "Owner type", [
                    "Individual",
                    "LLC",
                    "Corporation",
                    "Partnership",
                    "Other or unsure",
                  ])}
                  {input("email", "Contact email", "email")}
                  {area("mailingAddress", "Mailing address")}
                </section>

                <section className="card">
                  <h2>2. Brand information</h2>
                  {select("markType", "Mark type", [
                    "Brand name or words",
                    "Logo or design",
                    "Words and design",
                    "Unsure",
                  ])}
                  {input("brandName", "Brand name or wording")}
                  {area("logoDescription", "Logo or design description")}
                  <p className="hint">
                    Describe the design if applicable. File uploads
                    are not included on this page.
                  </p>
                  {area("goodsServices", "Products or services")}
                  {select("useStatus", "Current use", [
                    "Currently using the brand",
                    "Planning to use the brand",
                    "Unsure",
                  ])}
                  {input("firstUseDate", "First-use date, if known", "date")}
                  {input("website", "Website or store link", "url")}
                  {area(
                    "supportingNotes",
                    "Supporting materials and questions"
                  )}
                  <p className="hint">
                    Do not enter Social Security numbers, payment
                    details, passwords, or confidential materials.
                  </p>
                </section>

                <section className="card payment">
                  <h2>3. Preparation Package — $24.99</h2>

                  {paid ? (
                    <p className="success">
                      Preparation payment confirmed for this draft.
                    </p>
                  ) : (
                    <>
                      <label className="confirmation">
                        <input
                          type="checkbox"
                          checked={acknowledged}
                          onChange={(event) =>
                            setAcknowledged(event.target.checked)
                          }
                        />
                        <span>
                          This package concerns one proposed brand.
                          I understand $24.99 purchases a preparation
                          summary and checklist, and does not include
                          searches, legal advice, government filing,
                          government fees, or representation.
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => void checkout()}
                        disabled={!acknowledged || paymentUnresolved}
                      >
                        Purchase Preparation — $24.99
                      </button>
                    </>
                  )}
                </section>

                <section className="card">
                  <h2>4. Save and download</h2>

                  <label className="confirmation">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(event) =>
                        setReviewed(event.target.checked)
                      }
                    />
                    <span>
                      I have reviewed my answers. I understand blank
                      fields remain unfinished and this PDF is a
                      preparation summary, not a government filing.
                    </span>
                  </label>

                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => void saveDraft()}
                    >
                      Save Draft
                    </button>

                    <button
                      type="button"
                      onClick={() => void download()}
                      disabled={!paid || !reviewed}
                    >
                      Download Preparation PDF
                    </button>
                  </div>

                  <p>
                    {dirty
                      ? "You have unsaved changes."
                      : applicationId
                        ? "Your draft is saved to your account."
                        : "Click Save Draft to create an account draft."}
                    {!paid && " Verified payment is required to download."}
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
          font-family: Arial, sans-serif;
        }
        .container {
          max-width: 960px;
          margin: auto;
        }
        nav,
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
        }
        .container :global(a) {
          color: #67e8f9;
          overflow-wrap: anywhere;
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
        p,
        li {
          line-height: 1.7;
          overflow-wrap: anywhere;
        }
        li {
          margin-bottom: 12px;
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
          max-width: 100%;
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
