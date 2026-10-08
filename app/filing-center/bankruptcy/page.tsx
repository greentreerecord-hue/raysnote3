"use client";

import { useState, type CSSProperties } from "react";

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
    hint: "List income sources, amounts, and how often you receive them.",
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
  {
    name: "questions",
    label: "Questions for an attorney",
    rows: 4,
  },
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

export default function HawaiiBankruptcyPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  return (
    <main className="bankruptcy-page">
      <div className="page-content">
        <nav className="screen-only">
          <a href="/filing-center" style={buttonStyle}>
            ← Back to Filing Center
          </a>
        </nav>

        <header>
          <h1>Hawaii Bankruptcy Preparation Package</h1>
          <p>
            Organize your information for review with an attorney
            or alongside official court instructions.
          </p>
        </header>

        <section className="notice">
          <h2>Preparation summary only</h2>
          <p>
            This questionnaire is not a bankruptcy petition, a complete
            list of required disclosures, or legal advice. It does not
            determine eligibility, select a bankruptcy chapter, or file
            anything with the court.
          </p>
          <p>
            Your answers are held only while this page remains open.
            They are not saved by this form or sent to Ray&apos;sNotes.
            Refreshing or closing the page clears them.
          </p>
          <p>
            Do not enter Social Security numbers, account numbers,
            passwords, or upload financial documents here.
          </p>
        </section>

        <section className="screen-only resource-links">
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
          <p>
            These links provide information. Choosing a link does
            not select a chapter or submit a case.
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
                className="screen-only"
                id={field.name}
                rows={field.rows}
                value={answers[field.name] || ""}
                aria-describedby={
                  "hint" in field ? `${field.name}-hint` : undefined
                }
                onChange={(event) =>
                  setAnswers((previous) => ({
                    ...previous,
                    [field.name]: event.target.value,
                  }))
                }
              />

              <div className="print-answer">
                {answers[field.name] || "Not entered"}
              </div>
            </div>
          ))}
        </section>

        <section>
          <h2>Documents to Gather for Review</h2>
          <p>
            Keep these documents in your own secure storage.
            This checklist does not replace the court&apos;s requirements.
          </p>

          {checklist.map((item) => (
            <label className="checklist-item" key={item}>
              <input
                className="screen-only"
                type="checkbox"
                checked={!!checked[item]}
                onChange={(event) =>
                  setChecked((previous) => ({
                    ...previous,
                    [item]: event.target.checked,
                  }))
                }
              />
              <span className="print-only">
                {checked[item] ? "Gathered: " : "Still to gather: "}
              </span>
              {item}
            </label>
          ))}
        </section>

        <section className="screen-only">
          <h2>Save Your Summary</h2>
          <p>
            Click below, then choose your printer or “Save as PDF”
            in the print window. The summary may contain private
            financial information; keep your copy secure.
          </p>

          <button
            type="button"
            style={buttonStyle}
            onClick={() => window.print()}
          >
            Print / Save Summary as PDF
          </button>
        </section>

        <footer>
          Ray&apos;sNotes preparation summary — not filed with any court.
        </footer>
      </div>

      <style jsx>{`
        .bankruptcy-page {
          min-height: 100vh;
          padding: 32px 20px;
          background: #080808;
          color: white;
          font-family: Arial, sans-serif;
          line-height: 1.7;
        }
        .page-content {
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
        .field {
          margin: 24px 0;
        }
        .field label {
          display: block;
          font-size: 18px;
          font-weight: bold;
        }
        .field p {
          margin: 6px 0 10px;
        }
        textarea {
          display: block;
          box-sizing: border-box;
          width: 100%;
          padding: 12px;
          border: 1px solid #777;
          border-radius: 8px;
          background: #080808;
          color: white;
          font: inherit;
          resize: vertical;
        }
        textarea:focus-visible {
          outline: 3px solid #60a5fa;
          outline-offset: 2px;
        }
        .checklist-item {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin: 12px 0;
        }
        .print-answer,
        .print-only {
          display: none;
        }
        footer {
          margin: 32px 0;
          color: #ccc;
        }
        @media print {
          .screen-only {
            display: none !important;
          }
          .print-answer,
          .print-only {
            display: block;
          }
          .print-answer {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            margin-top: 8px;
          }
          .bankruptcy-page {
            background: white;
            color: black;
            padding: 0;
          }
          section {
            background: white;
            border-color: #aaa;
            padding: 14px;
          }
          p,
          footer {
            color: black;
          }
          h2,
          .field label {
            break-after: avoid;
          }
          .checklist-item {
            break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
} 
