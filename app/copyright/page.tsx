"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

const PAYMENT_LINK =
  "https://buy.stripe.com/3cI6oHbR8dkjcw21Dz2Nq05";

const RECORDS_KEY = "raysnotes-copyright-records";
const CREDIT_KEY = "raysnotes-copyright-payment-credit";

type CreationRecord = {
  id: string;
  creator: string;
  email: string;
  title: string;
  type: string;
  creationDate: string;
  description: string;
  fileName: string;
  fileSize: number | null;
  fileHash: string;
  recordHash: string;
  recordedAt: string;
};

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createHash(value: string | ArrayBuffer) {
  const data =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : value;

  const result = await crypto.subtle.digest("SHA-256", data);
  return toHex(result);
}

function safeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "creation"
  );
}

export default function CopyrightPage() {
  const [records, setRecords] = useState<CreationRecord[]>([]);
  const [creator, setCreator] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [workType, setWorkType] = useState("Music");
  const [creationDate, setCreationDate] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const savedRecords = localStorage.getItem(RECORDS_KEY);

      if (savedRecords) {
        const parsedRecords = JSON.parse(savedRecords);

        if (Array.isArray(parsedRecords)) {
          setRecords(parsedRecords);
        }
      }
    } catch {
      localStorage.removeItem(RECORDS_KEY);
    }

    async function verifyPayment() {
      const searchParams = new URLSearchParams(
        window.location.search
      );

      const sessionId = searchParams.get("session_id");

      if (!sessionId) {
        const savedCredit = localStorage.getItem(CREDIT_KEY);
        setPaid(Boolean(savedCredit));
        setChecking(false);
        return;
      }

      setNotice("Verifying your Stripe payment...");

      try {
        const response = await fetch(
          `/api/copyright-payment?session_id=${encodeURIComponent(
            sessionId
          )}`,
          {
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok || result.paid !== true) {
          throw new Error(
            result.error || "Payment could not be verified."
          );
        }

        localStorage.setItem(CREDIT_KEY, sessionId);
        setPaid(true);

        setNotice(
          "Payment verified. You may create one private creation record."
        );

        window.history.replaceState({}, "", "/copyright");
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Payment could not be verified."
        );
      } finally {
        setChecking(false);
      }
    }

    verifyPayment();
  }, []);

  function saveRecords(nextRecords: CreationRecord[]) {
    setRecords(nextRecords);

    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify(nextRecords)
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!paid) {
      setNotice(
        "Purchase a creation record before using the form."
      );
      return;
    }

    if (
      !creator.trim() ||
      !title.trim() ||
      !creationDate
    ) {
      setNotice(
        "Creator name, work title, and creation date are required."
      );
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      let fileHash = "";

      if (file) {
        const fileBuffer = await file.arrayBuffer();
        fileHash = await createHash(fileBuffer);
      }

      const recordInformation = {
        id: crypto.randomUUID(),
        creator: creator.trim(),
        email: email.trim().toLowerCase(),
        title: title.trim(),
        type: workType,
        creationDate,
        description: description.trim(),
        fileName: file ? file.name : "",
        fileSize: file ? file.size : null,
        fileHash,
        recordedAt: new Date().toISOString(),
      };

      const recordHash = await createHash(
        JSON.stringify(recordInformation)
      );

      const newRecord: CreationRecord = {
        ...recordInformation,
        recordHash,
      };

      saveRecords([newRecord, ...records]);

      localStorage.removeItem(CREDIT_KEY);
      setPaid(false);

      setCreator("");
      setEmail("");
      setTitle("");
      setWorkType("Music");
      setCreationDate("");
      setDescription("");
      setFile(null);

      const fileInput = document.getElementById(
        "work-file"
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      setNotice(
        "Creation record saved privately on this device."
      );
    } catch {
      setNotice(
        "The creation record could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  function downloadRecord(record: CreationRecord) {
    const recordText = `RAY'SNOTES CREATION RECORD
================================

Record ID: ${record.id}
Recorded: ${new Date(record.recordedAt).toLocaleString()}

Creator: ${record.creator}
Email: ${record.email || "Not provided"}
Work title: ${record.title}
Work type: ${record.type}
Creation date: ${record.creationDate}
Description: ${record.description || "None"}
Original file: ${record.fileName || "Not attached"}
File size: ${record.fileSize ?? "Not available"}

FILE SHA-256 FINGERPRINT
${record.fileHash || "No file attached"}

RECORD SHA-256 FINGERPRINT
${record.recordHash}

IMPORTANT NOTICE
This record documents information entered by the user.
It is not registration with the United States Copyright Office.
It does not prove copyright ownership by itself.
It is not legal advice.

Official registration:
https://www.copyright.gov/registration/
`;

    const blob = new Blob([recordText], {
      type: "text/plain;charset=utf-8",
    });

    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");

    downloadLink.href = downloadUrl;
    downloadLink.download = `${safeFileName(
      record.title
    )}-creation-record.txt`;

    downloadLink.click();
    URL.revokeObjectURL(downloadUrl);
  }

  function deleteRecord(recordId: string) {
    const confirmed = window.confirm(
      "Delete this private record from this browser?"
    );

    if (!confirmed) {
      return;
    }

    const remainingRecords = records.filter(
      (record) => record.id !== recordId
    );

    saveRecords(remainingRecords);
  }

  return (
    <main className="page">
      <Link className="homeButton" href="/">
        ← Ray&apos;sNotes Home
      </Link>

      <section className="hero">
        <div className="copyrightSymbol">©</div>

        <div>
          <p className="eyebrow">
            PROTECT YOUR CREATIVE WORK
          </p>

          <h1>Ray&apos;sNotes Copyright Center</h1>

          <p>
            Create a private record and digital fingerprint
            for your original work.
          </p>
        </div>
      </section>

      <section className="warning">
        <h2>Important Copyright Notice</h2>

        <p>
          A Ray&apos;sNotes creation record is not
          registration with the United States Copyright
          Office and does not prove ownership by itself.
        </p>

        <a
          href="https://www.copyright.gov/registration/"
          target="_blank"
          rel="noreferrer"
        >
          Visit the U.S. Copyright Office ↗
        </a>
      </section>

      <section className="payment">
        <h2>Creation Record — $9.99</h2>

        <p>
          One payment creates one private creation record.
        </p>

        {checking ? (
          <p>Checking payment status...</p>
        ) : paid ? (
          <p className="success">
            ✓ Payment verified. The form is unlocked.
          </p>
        ) : (
          <a className="buyButton" href={PAYMENT_LINK}>
            Purchase Creation Record — $9.99
          </a>
        )}
      </section>

      <section
        className={`formCard ${paid ? "" : "locked"}`}
      >
        <h2>Create a Private Creation Record</h2>

        {!paid && (
          <p className="lockMessage">
            🔒 Complete payment to unlock this form.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="formGrid">
            <label>
              Creator or legal name
              <input
                value={creator}
                onChange={(event) =>
                  setCreator(event.target.value)
                }
                disabled={!paid}
                required
              />
            </label>

            <label>
              Email address (optional)
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                disabled={!paid}
              />
            </label>

            <label>
              Work title
              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                disabled={!paid}
                required
              />
            </label>

            <label>
              Work type
              <select
                value={workType}
                onChange={(event) =>
                  setWorkType(event.target.value)
                }
                disabled={!paid}
              >
                <option>Music</option>
                <option>Video</option>
                <option>Writing</option>
                <option>Photography</option>
                <option>Artwork</option>
                <option>Software</option>
                <option>Other Creative Work</option>
              </select>
            </label>

            <label>
              Creation date
              <input
                type="date"
                value={creationDate}
                onChange={(event) =>
                  setCreationDate(event.target.value)
                }
                disabled={!paid}
                required
              />
            </label>

            <label>
              Original file (optional)
              <input
                id="work-file"
                type="file"
                onChange={(event) =>
                  setFile(event.target.files?.[0] || null)
                }
                disabled={!paid}
              />
            </label>
          </div>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              disabled={!paid}
              rows={5}
            />
          </label>

          <button
            type="submit"
            disabled={!paid || saving}
          >
            {saving
              ? "Creating record..."
              : "Create Private Record"}
          </button>
        </form>

        {notice && <p className="notice">{notice}</p>}
      </section>

 <section
        style={{
          maxWidth: "1050px",
          margin: "0 auto 24px",
          padding: "28px",
          color: "#111111",
          textAlign: "center",
          background: "#fff4d6",
          border: "3px solid #ffae24",
          borderRadius: "22px",
        }}
      >
        <h2>Need Help Preparing an Official Application?</h2>

        <p>
          Use our guided questionnaire to organize your
          information and download a filing summary.
        </p>

        <Link
          href="/copyright/apply"
          style={{
            display: "inline-block",
            padding: "16px 22px",
            color: "#ffffff",
            fontWeight: 900,
            textDecoration: "none",
            background: "#1769e0",
            borderRadius: "12px",
          }}
        >
          Start Assisted Copyright Application
        </Link>
      </section>
 <section
        style={{
          maxWidth: "1050px",
          margin: "0 auto 24px",
          padding: "28px",
          color: "#111111",
          textAlign: "center",
          background: "#eafaf1",
          border: "3px solid #20b86a",
          borderRadius: "22px",
        }}
      >
        <p
          style={{
            color: "#08783f",
            fontWeight: 900,
            letterSpacing: "2px",
          }}
        >
          FULL-SERVICE FILING
        </p>

        <h2>
          Register Up to 10 Unpublished Songs — $159
        </h2>

        <p>
          Includes a $74 Ray&apos;sNotes service fee and the
          $85 U.S. Copyright Office group filing fee.
        </p>

        <p>
          Ray&apos;sNotes reviews eligibility, prepares the
          application, and manually submits eligible filings.
          Registration is not guaranteed. No legal advice.
        </p>

        <Link
          href="/copyright/group-filing"
          style={{
            display: "inline-block",
            padding: "16px 22px",
            color: "#ffffff",
            fontWeight: 900,
            textDecoration: "none",
            background: "#087fdd",
            borderRadius: "12px",
          }}
        >
          Start Full-Service Group Filing — $159
        </Link>
      </section> 
    
<section className="records">
        <h2>My Saved Creation Records</h2>

        {records.length === 0 ? (
          <p>
            No creation records are saved in this browser
            yet.
          </p>
        ) : (
          records.map((record) => (
            <article className="record" key={record.id}>
              <span className="recordType">
                {record.type}
              </span>

              <h3>{record.title}</h3>
              <h4>Created by {record.creator}</h4>

              <p>
                Creation date: {record.creationDate}
              </p>

              <p>
                Recorded:{" "}
                {new Date(
                  record.recordedAt
                ).toLocaleString()}
              </p>

              <div className="hash">
                <strong>
                  SHA-256 record fingerprint
                </strong>

                <code>{record.recordHash}</code>
              </div>

              <div className="actions">
                <button
                  type="button"
                  onClick={() => downloadRecord(record)}
                >
                  Download Record
                </button>

                <button
                  type="button"
                  className="deleteButton"
                  onClick={() => deleteRecord(record.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 28px;
          color: white;
          font-family: Arial, sans-serif;
          background: linear-gradient(
            145deg,
            #050816,
            #14245b
          );
        }

        .homeButton,
        .buyButton,
        .warning a {
          display: inline-block;
          color: white;
          font-weight: 800;
          text-decoration: none;
          border-radius: 12px;
        }

        .homeButton {
          margin-bottom: 26px;
          padding: 14px 20px;
          border: 2px solid white;
        }

        .hero,
        .warning,
        .payment,
        .formCard,
        .records {
          max-width: 1050px;
          margin: 0 auto 24px;
          padding: 28px;
          border-radius: 22px;
        }

        .hero {
          display: flex;
          align-items: center;
          gap: 24px;
          border: 3px solid #20df78;
          background: linear-gradient(
            120deg,
            #102d64,
            #32175c
          );
        }

        .copyrightSymbol {
          display: grid;
          width: 105px;
          height: 105px;
          flex-shrink: 0;
          place-items: center;
          color: #07111f;
          font-size: 64px;
          background: #20df78;
          border: 7px solid white;
          border-radius: 50%;
        }

        .eyebrow {
          color: #32f98c;
          font-weight: 900;
          letter-spacing: 3px;
        }

        h1 {
          margin: 8px 0;
          font-size: clamp(34px, 6vw, 70px);
        }

        h2 {
          margin-top: 0;
          font-size: 32px;
        }

        .warning {
          color: #111111;
          background: white;
          border: 3px solid #ff9d20;
        }

        .warning a {
          padding: 13px 18px;
          background: #1769e0;
        }

        .payment {
          color: #07111f;
          text-align: center;
          background: #ecfeff;
          border: 3px solid #1dd3c8;
        }

        .buyButton {
          padding: 18px 25px;
          color: #07111f;
          font-size: 20px;
          background: #20d978;
          border: 3px solid white;
          box-shadow: 0 0 0 2px #07111f;
        }

        .success {
          color: #087f3e;
          font-weight: 900;
        }

        .formCard,
        .records {
          color: #111111;
          background: white;
          border: 3px solid #1dd3c8;
        }

        .locked {
          border-color: #94a3b8;
        }

        .lockMessage,
        .notice {
          padding: 14px;
          color: #064b89;
          font-weight: 800;
          background: #e6f4ff;
          border-radius: 10px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(250px, 1fr)
          );
          gap: 18px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 18px;
          font-weight: 800;
        }

        input,
        select,
        textarea {
          padding: 13px;
          font: inherit;
          background: white;
          border: 2px solid #334155;
          border-radius: 10px;
        }

        input:disabled,
        select:disabled,
        textarea:disabled {
          background: #e5e7eb;
        }

        button {
          padding: 15px 20px;
          color: white;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
          background: #0aa85b;
          border: 0;
          border-radius: 10px;
        }

        button:disabled {
          cursor: not-allowed;
          background: #94a3b8;
        }

        .record {
          margin-top: 18px;
          padding: 22px;
          border: 2px solid #334155;
          border-radius: 18px;
        }

        .recordType {
          display: inline-block;
          padding: 8px 14px;
          color: white;
          font-weight: 900;
          background: #4338ca;
          border-radius: 999px;
        }

        .record h3 {
          margin: 14px 0 6px;
          font-size: 30px;
        }

        .record h4 {
          margin: 0 0 15px;
          color: #075fbd;
          font-size: 20px;
        }

        .hash {
          padding: 14px;
          background: #eef2ff;
          border: 1px solid #64748b;
          border-radius: 12px;
        }

        .hash code {
          display: block;
          margin-top: 8px;
          overflow-wrap: anywhere;
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 18px;
        }

        .deleteButton {
          background: #c62828;
        }

        @media (max-width: 600px) {
          .page {
            padding: 15px;
          }

          .hero {
            display: block;
          }

          .copyrightSymbol {
            width: 75px;
            height: 75px;
            font-size: 45px;
          }

          h2 {
            font-size: 26px;
          }
        }
      `}</style>
    </main>
  );
} 

