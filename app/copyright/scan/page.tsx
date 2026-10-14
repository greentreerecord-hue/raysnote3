"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function CopyrightScanPage() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [permission, setPermission] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setReport("");

    if (!text.trim() && !image) {
      setError("Enter text or choose an image.");
      return;
    }

    if (
      image &&
      !["image/jpeg", "image/png", "image/webp"].includes(
        image.type
      )
    ) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (image && image.size > 3 * 1024 * 1024) {
      setError("Choose an image smaller than 3 MB.");
      return;
    }

    if (!consent) {
      setError("Please check the consent box.");
      return;
    }

    setBusy(true);

    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("text", text.trim());
      form.set("permission", permission.trim());
      form.set("consent", "true");

      if (image) {
        form.set("image", image);
      }

      const response = await fetch("/api/copyright-scan", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(120000),
      });

      if (response.status === 404) {
        throw new Error(
          "The scanning service is not connected yet."
        );
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "The scan could not be completed."
        );
      }

      if (
        typeof result.report !== "string" ||
        !result.report.trim()
      ) {
        throw new Error(
          "No report was returned. Please try again."
        );
      }

      setReport(result.report);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The scan could not be completed."
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadReport() {
    const content = [
      "RAY'SNOTES AI COPYRIGHT RISK SCAN",
      `Project: ${title.trim() || "Untitled"}`,
      `Downloaded: ${new Date().toLocaleString()}`,
      "",
      report,
      "",
      "Automated findings are informational.",
      "This report is not legal clearance or proof of ownership.",
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([content], {
        type: "text/plain;charset=utf-8",
      })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "raysnotes-copyright-scan-report.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main>
      <div className="container">
        <Link href="/copyright" className="back">
          ← Copyright Center
        </Link>

        <header>
          <p className="eyebrow">RAY&apos;SNOTES</p>
          <h1>AI Copyright Risk Scan</h1>
          <p>
            Submit text or an image for an automated review
            of possible copyright concerns.
          </p>
        </header>

        <section className="notice">
          <strong>What this report means</strong>
          <p>
            Findings may be incomplete or incorrect.
            No matches found does not mean copyright-free.
            The report does not establish ownership,
            infringement, permission, or legal clearance.
          </p>
        </section>

        <section className="card">
          <h2>Your project</h2>

          <form onSubmit={handleSubmit}>
            <label htmlFor="project-title">
              Project title
            </label>
            <input
              id="project-title"
              value={title}
              maxLength={150}
              onChange={(event) => {
                setTitle(event.target.value);
                setReport("");
              }}
              disabled={busy}
              placeholder="Name your project"
              required
            />

            <label htmlFor="project-text">
              Text to review
            </label>
            <textarea
              id="project-text"
              value={text}
              maxLength={12000}
              onChange={(event) => {
                setText(event.target.value);
                setReport("");
              }}
              disabled={busy}
              rows={9}
              placeholder="Paste your writing here."
            />
            <p className="hint">
              {text.length.toLocaleString()} / 12,000 characters
            </p>

            <label htmlFor="project-image">
              Image to review
            </label>
            <input
              id="project-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setImage(event.target.files?.[0] || null);
                setReport("");
              }}
              disabled={busy}
            />
            <p className="hint">
              JPG, PNG, or WebP. Maximum 3 MB.
              Music and video are not supported in this version.
            </p>

            <label htmlFor="project-permission">
              Source and permission information (optional)
            </label>
            <textarea
              id="project-permission"
              value={permission}
              maxLength={3000}
              onChange={(event) => {
                setPermission(event.target.value);
                setReport("");
              }}
              disabled={busy}
              rows={4}
              placeholder="Describe where the material came from and any licenses or permissions."
            />

            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) =>
                  setConsent(event.target.checked)
                }
                disabled={busy}
                required
              />
              <span>
                I am authorized to submit this material.
                I consent to sending it to AI and search
                providers for analysis. Search queries may
                include excerpts or descriptions from my project.
                I understand this is not legal clearance.
              </span>
            </label>

            <button
              type="submit"
              disabled={busy || !consent}
            >
              {busy ? "Reviewing project..." : "Run AI Scan"}
            </button>

            {busy && (
              <p role="status">
                Please keep this page open while the scan runs.
              </p>
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>

        {report && (
          <section className="card" aria-live="polite">
            <h2>Automated findings report</h2>
            <div className="report">{report}</div>

            <button
              type="button"
              onClick={downloadReport}
            >
              Download Report
            </button>
          </section>
        )}
      </div>

      <style jsx>{`
        main {
          min-height: 100vh;
          padding: 28px 16px 60px;
          color: white;
          background: linear-gradient(
            145deg,
            #050816,
            #14245b
          );
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 900px;
          margin: 0 auto;
        }

        :global(a.back) {
          display: inline-block;
          margin-bottom: 24px;
          padding: 12px 18px;
          color: white;
          border: 2px solid white;
          border-radius: 12px;
          text-decoration: none;
          font-weight: bold;
        }

        header {
          padding: 28px;
          border: 3px solid #8b5cf6;
          border-radius: 22px;
          background: #251747;
        }

        .eyebrow {
          color: #c4b5fd;
          font-weight: 900;
          letter-spacing: 3px;
        }

        h1 {
          margin: 12px 0;
          font-size: clamp(30px, 6vw, 52px);
        }

        h2 {
          margin-top: 0;
          font-size: 28px;
        }

        p {
          line-height: 1.6;
        }

        .notice {
          margin-top: 24px;
          padding: 22px;
          color: #422006;
          background: #fff4d6;
          border: 3px solid #ffae24;
          border-radius: 18px;
        }

        .card {
          margin-top: 24px;
          padding: 28px;
          color: #111827;
          background: white;
          border: 3px solid #8b5cf6;
          border-radius: 22px;
        }

        label {
          display: block;
          margin-top: 20px;
          margin-bottom: 8px;
          font-weight: 800;
        }

        input,
        textarea {
          box-sizing: border-box;
          width: 100%;
          padding: 13px;
          color: #111827;
          background: white;
          border: 2px solid #64748b;
          border-radius: 10px;
          font: inherit;
        }

        textarea {
          resize: vertical;
        }

        .hint {
          margin-top: 8px;
          color: #475569;
          font-size: 14px;
        }

        .consent {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          line-height: 1.5;
          font-size: 15px;
        }

        .consent input {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          margin-top: 3px;
        }

        button {
          margin-top: 20px;
          padding: 16px 24px;
          color: white;
          background: #6d28d9;
          border: 0;
          border-radius: 12px;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .error {
          padding: 14px;
          color: #991b1b;
          background: #fee2e2;
          border-radius: 10px;
        }

        .report {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.7;
        }

        @media (max-width: 600px) {
          header,
          .card {
            padding: 20px;
          }

          button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
} 
