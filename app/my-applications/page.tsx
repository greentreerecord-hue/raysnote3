"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Account = {
  email: string;
};

type Application = {
  id: string;
  title: string;
  paid: boolean;
  updatedAt: string;
};

export default function MyApplicationsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadApplications() {
    const response = await fetch("/api/my-applications", {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Applications could not be loaded.");
    }

    setApplications(result.applications);
  }

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/application-account", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Account could not be loaded.");
        }

        setAccount(result.account);

        if (result.account) {
          await loadApplications();
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/application-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: register ? "register" : "login",
          email,
          password,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Sign-in failed.");
      }

      setAccount(result.account);
      setPassword("");
      await loadApplications();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sign-in failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);

    try {
      const response = await fetch("/api/application-account", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Sign-out failed. Please try again.");
      }

      setAccount(null);
      setApplications([]);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sign-out failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function startApplication() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/my-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled application" }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Application could not be created.");
      }

      window.location.assign(
        `/copyright/apply?application_id=${encodeURIComponent(
          result.application.id
        )}`
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Please try again."
      );
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="container">
        <Link href="/copyright">← Copyright Center</Link>

        <header>
          <p className="eyebrow">RAY&apos;SNOTES</p>
          <h1>My Applications</h1>
          <p>Keep your preparation drafts and payments together by work.</p>
        </header>

        {message && <p role="status" className="message">{message}</p>}

        {loading ? (
          <p>Loading your account…</p>
        ) : !account ? (
          <section className="card">
            <h2>{register ? "Create your account" : "Sign in"}</h2>
            <p>Use your account to return to your saved applications.</p>

            <form onSubmit={signIn}>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>

              {register && <p>Choose a password with at least 12 characters.</p>}

              <button disabled={busy} type="submit">
                {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
              </button>
            </form>

            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setMessage("");
              }}
            >
              {register ? "Already have an account? Sign in" : "Create an account"}
            </button>
          </section>
        ) : (
          <>
            <div className="toolbar">
              <p>Signed in as {account.email}</p>
              <button className="secondary" onClick={signOut} disabled={busy}>
                Sign out
              </button>
            </div>

            <button onClick={startApplication} disabled={busy}>
              {busy ? "Please wait…" : "+ Start New Application"}
            </button>

            <p className="note">
              Each new application needs its own payment. These are preparation
              summaries; they do not indicate Copyright Office registration.
            </p>

            {applications.length === 0 ? (
              <section className="card">
                <h2>No applications yet</h2>
                <p>Start an application for Rabbit Hill or another work.</p>
              </section>
            ) : (
              <div className="applications">
                {applications.map((application) => (
                  <section className="card" key={application.id}>
                    <span className={application.paid ? "badge paid" : "badge"}>
                      {application.paid ? "Payment received" : "Payment needed"}
                    </span>
                    <h2>{application.title || "Untitled application"}</h2>
                    <p>
                      Updated{" "}
                      {new Date(application.updatedAt).toLocaleDateString()}
                    </p>
                    <Link
                      className="open"
                      href={`/copyright/apply?application_id=${encodeURIComponent(
                        application.id
                      )}`}
                    >
                      Open application
                    </Link>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #080f24;
          color: #edf2ff;
          padding: 40px 20px 80px;
        }
        .container {
          max-width: 960px;
          margin: auto;
        }
        header {
          margin: 40px 0 30px;
        }
        h1 {
          font-size: clamp(32px, 6vw, 52px);
          margin: 8px 0 16px;
        }
        h2 {
          margin: 16px 0;
        }
        p {
          line-height: 1.6;
          overflow-wrap: anywhere;
        }
        .eyebrow {
          color: #67e8f9;
          letter-spacing: 3px;
          font-weight: 700;
        }
        .card {
          background: #14203a;
          border: 1px solid #344662;
          border-radius: 18px;
          padding: 26px;
          margin-top: 24px;
        }
        form {
          max-width: 480px;
        }
        label {
          display: block;
          margin: 22px 0;
          font-weight: 600;
        }
        input {
          display: block;
          box-sizing: border-box;
          width: 100%;
          margin-top: 10px;
          padding: 14px;
          border: 1px solid #71829e;
          border-radius: 8px;
          background: #080f24;
          color: white;
          font: inherit;
        }
        button {
          background: #67e8f9;
          color: #082033;
          border: 0;
          border-radius: 10px;
          padding: 14px 20px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .secondary {
          background: transparent;
          color: #b9eaff;
          border: 1px solid #536984;
          margin-top: 16px;
        }
        .toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 24px;
        }
        .toolbar button {
          margin: 0;
        }
        .note {
          color: #bdcbe1;
          max-width: 680px;
        }
        .applications {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
        }
        .badge {
          display: inline-block;
          background: #49381c;
          color: #ffe0a3;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
        }
        .paid {
          background: #12463d;
          color: #a7f3d0;
        }
        .open {
          display: inline-block;
          color: #67e8f9;
          margin-top: 12px;
        }
        .message {
          padding: 16px;
          background: #243650;
          border-radius: 10px;
        }
      `}</style>
    </main>
  );
} 
