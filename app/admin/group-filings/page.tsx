"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DepositFile = {
  name: string;
  pathname: string;
  url?: string;
  contentType?: string;
};

type FilingRequest = {
  id: number;
  reference: string;
  author_name: string;
  claimant_name: string;
  citizenship: string;
  work_for_hire: string;
  song_titles: string[];
  deposit_files: DepositFile[];
  authorship_type: string;
  notes: string | null;
  email: string;
  phone: string;
  mailing_address: string;
  eligibility_confirmed: boolean;
  authorization_confirmed: boolean;
  status: string;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: "pending_review", label: "Pending Review" },
  {
    value: "needs_information",
    label: "Needs Information",
  },
  { value: "eligible", label: "Eligible" },
  {
    value: "filing_submitted",
    label: "Filing Submitted",
  },
  { value: "completed", label: "Completed" },
  { value: "ineligible", label: "Ineligible" },
  { value: "refunded", label: "Refunded" },
];

export default function GroupFilingsAdminPage() {
  const [password, setPassword] = useState("");
  const [requests, setRequests] = useState<
    FilingRequest[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState("");
  const [updating, setUpdating] = useState("");

  useEffect(() => {
    const savedPassword = sessionStorage.getItem(
      "raysnotes-group-filings-admin-password"
    );

    if (savedPassword) {
      setPassword(savedPassword);
      loadRequests(savedPassword);
    }
  }, []);

  async function loadRequests(passwordToUse = password) {
    if (!passwordToUse) {
      setMessage("Enter the administrator password.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        "/api/admin/group-filings",
        {
          cache: "no-store",
          headers: {
            "x-admin-password": passwordToUse,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "The requests could not be loaded."
        );
      }

      sessionStorage.setItem(
        "raysnotes-group-filings-admin-password",
        passwordToUse
      );

      setAuthorized(true);
      setRequests(
        Array.isArray(data.requests) ? data.requests : []
      );
    } catch (error) {
      sessionStorage.removeItem(
        "raysnotes-group-filings-admin-password"
      );
      setAuthorized(false);
      setRequests([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Administrator access failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function logOut() {
    sessionStorage.removeItem(
      "raysnotes-group-filings-admin-password"
    );
    setPassword("");
    setRequests([]);
    setAuthorized(false);
    setMessage("");
  }

  async function updateStatus(
    reference: string,
    status: string
  ) {
    try {
      setUpdating(reference);
      setMessage("");

      const response = await fetch(
        "/api/admin/group-filings",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": password,
          },
          body: JSON.stringify({
            reference,
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "The status could not be updated."
        );
      }

      setRequests((current) =>
        current.map((request) =>
          request.reference === reference
            ? { ...request, status }
            : request
        )
      );

      setMessage(`Status updated for ${reference}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The status could not be updated."
      );
    } finally {
      setUpdating("");
    }
  }

  async function downloadFile(file: DepositFile) {
    try {
      setDownloading(file.pathname);
      setMessage("");

      const response = await fetch(
        `/api/admin/group-filing-download?pathname=${encodeURIComponent(
          file.pathname
        )}&name=${encodeURIComponent(file.name)}`,
        {
          headers: {
            "x-admin-password": password,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.error || "The file could not be downloaded."
        );
      }

      const fileBlob = await response.blob();
      const downloadUrl =
        window.URL.createObjectURL(fileBlob);
      const downloadLink =
        document.createElement("a");

      downloadLink.href = downloadUrl;
      downloadLink.download = file.name || "song-file";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
      }, 1000);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The file could not be downloaded."
      );
    } finally {
      setDownloading("");
    }
  }

  return (
    <main className="page">
      <div className="container">
        <Link className="backButton" href="/">
          ← Admin Dashboard
        </Link>

        <div className="heading">
          <div>
            <p className="eyebrow">
              PRIVATE COPYRIGHT ADMINISTRATION
            </p>
            <h1>Group Filing Requests</h1>
          </div>

          {authorized && (
            <button
              className="logoutButton"
              type="button"
              onClick={logOut}
            >
              Log Out
            </button>
          )}
        </div>

        {!authorized ? (
          <section className="loginCard">
            <h2>Administrator Access</h2>

            <p>
              Enter the same administrator password used for
              the Ray&apos;sNotes admin area.
            </p>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  loadRequests();
                }
              }}
              placeholder="Administrator password"
            />

            <button
              type="button"
              onClick={() => loadRequests()}
              disabled={loading}
            >
              {loading
                ? "Checking..."
                : "Open Filing Requests"}
            </button>
          </section>
        ) : (
          <>
            <section className="summary">
              <strong>{requests.length}</strong>
              <span>
                total full-service group filing request(s)
              </span>

              <button
                type="button"
                onClick={() => loadRequests()}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </section>

            {requests.length === 0 ? (
              <section className="emptyCard">
                <h2>No filing requests yet</h2>
                <p>
                  Paid customer requests will appear here
                  after they upload their songs and submit the
                  form.
                </p>
              </section>
            ) : (
              requests.map((request) => (
                <article
                  className="requestCard"
                  key={request.reference}
                >
                  <div className="requestHeader">
                    <div>
                      <p className="reference">
                        {request.reference}
                      </p>
                      <h2>{request.author_name}</h2>
                      <p>
                        Received{" "}
                        {new Date(
                          request.created_at
                        ).toLocaleString()}
                      </p>
                    </div>

                    <label>
                      Filing status
                      <select
                        value={request.status}
                        disabled={
                          updating === request.reference
                        }
                        onChange={(event) =>
                          updateStatus(
                            request.reference,
                            event.target.value
                          )
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option
                            value={status.value}
                            key={status.value}
                          >
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="detailsGrid">
                    <div>
                      <strong>Claimant</strong>
                      <p>{request.claimant_name}</p>
                    </div>

                    <div>
                      <strong>Citizenship/domicile</strong>
                      <p>{request.citizenship}</p>
                    </div>

                    <div>
                      <strong>Work made for hire</strong>
                      <p>{request.work_for_hire}</p>
                    </div>

                    <div>
                      <strong>Authorship</strong>
                      <p>{request.authorship_type}</p>
                    </div>

                    <div>
                      <strong>Email</strong>
                      <p>{request.email}</p>
                    </div>

                    <div>
                      <strong>Phone</strong>
                      <p>{request.phone}</p>
                    </div>
                  </div>

                  <section className="information">
                    <h3>Mailing address</h3>
                    <p className="preserve">
                      {request.mailing_address}
                    </p>
                  </section>

                  <section className="information">
                    <h3>Song titles</h3>
                    <ol>
                      {(request.song_titles || []).map(
                        (title, index) => (
                          <li key={`${title}-${index}`}>
                            {title}
                          </li>
                        )
                      )}
                    </ol>
                  </section>

                  <section className="information">
                    <h3>Private song files</h3>

                    {(request.deposit_files || []).length ===
                    0 ? (
                      <p>No private files are recorded.</p>
                    ) : (
                      <div className="fileList">
                        {request.deposit_files.map((file) => (
                          <button
                            type="button"
                            key={file.pathname}
                            onClick={() =>
                              downloadFile(file)
                            }
                            disabled={
                              downloading === file.pathname
                            }
                          >
                            {downloading === file.pathname
                              ? "Downloading..."
                              : `Download ${file.name}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="information">
                    <h3>
                      Coauthors, samples, beats, or other notes
                    </h3>
                    <p className="preserve">
                      {request.notes ||
                        "No additional notes provided."}
                    </p>
                  </section>

                  <div className="confirmations">
                    <p>
                      {request.eligibility_confirmed
                        ? "✓"
                        : "✗"}{" "}
                      Customer confirmed group eligibility
                    </p>

                    <p>
                      {request.authorization_confirmed
                        ? "✓"
                        : "✗"}{" "}
                      Customer authorized preparation and
                      filing
                    </p>
                  </div>
                </article>
              ))
            )}
          </>
        )}

        {message && <p className="message">{message}</p>}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 28px 16px 80px;
          color: #ffffff;
          font-family: Arial, sans-serif;
          background: linear-gradient(
            145deg,
            #06111f,
            #102f4d
          );
        }

        .container {
          max-width: 1100px;
          margin: 0 auto;
        }

        .backButton {
          display: inline-block;
          margin-bottom: 24px;
          padding: 12px 17px;
          color: #ffffff;
          font-weight: 800;
          text-decoration: none;
          border: 2px solid #ffffff;
          border-radius: 10px;
        }

        .heading,
        .requestHeader,
        .summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .eyebrow,
        .reference {
          color: #47ef91;
          font-weight: 900;
          letter-spacing: 2px;
        }

        h1 {
          margin: 5px 0 28px;
          font-size: clamp(38px, 7vw, 68px);
        }

        h2,
        h3 {
          margin-top: 0;
        }

        .loginCard,
        .summary,
        .emptyCard,
        .requestCard {
          margin-bottom: 22px;
          padding: 25px;
          color: #122033;
          background: #ffffff;
          border: 3px solid #32d987;
          border-radius: 18px;
        }

        .loginCard {
          max-width: 600px;
        }

        input,
        select {
          box-sizing: border-box;
          width: 100%;
          margin: 9px 0 15px;
          padding: 13px;
          font: inherit;
          border: 2px solid #526274;
          border-radius: 9px;
        }

        button {
          padding: 12px 17px;
          color: #ffffff;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
          background: #087fdd;
          border: 0;
          border-radius: 9px;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .logoutButton {
          background: #b42318;
        }

        .summary strong {
          font-size: 38px;
        }

        .summary span {
          flex: 1;
          font-weight: 700;
        }

        .requestCard {
          border-color: #38a9ee;
        }

        .requestHeader {
          align-items: flex-start;
          padding-bottom: 18px;
          border-bottom: 2px solid #d8e0e8;
        }

        .requestHeader label {
          min-width: 210px;
          font-weight: 800;
        }

        .detailsGrid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(220px, 1fr)
          );
          gap: 15px;
          margin: 20px 0;
        }

        .detailsGrid div,
        .information,
        .confirmations {
          padding: 15px;
          background: #f1f6fa;
          border-radius: 10px;
        }

        .detailsGrid p {
          margin-bottom: 0;
          overflow-wrap: anywhere;
        }

        .information {
          margin-top: 15px;
        }

        .preserve {
          white-space: pre-wrap;
        }

        .fileList {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .confirmations {
          margin-top: 15px;
          color: #08783f;
          font-weight: 800;
        }

        .message {
          padding: 14px;
          color: #07375f;
          font-weight: 800;
          background: #e2f3ff;
          border-radius: 10px;
        }

        @media (max-width: 650px) {
          .heading,
          .requestHeader,
          .summary {
            display: block;
          }

          .logoutButton,
          .summary button {
            margin-top: 12px;
          }

          .requestHeader label {
            display: block;
            margin-top: 15px;
          }
        }
      `}</style>
    </main>
  );
} 

