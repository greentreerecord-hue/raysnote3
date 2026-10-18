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
  const [llcApplications, setLLCApplications] = useState<Application[]>([]);
  const [copyrightError, setCopyrightError] = useState("");
  const [llcError, setLLCError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadApplications() {
    setCopyrightError("");
    setLLCError("");

    await Promise.all([
      (async () => {
        try {
          const response = await fetch("/api/my-applications", {
            cache: "no-store",
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.error || "Copyright applications could not be loaded."
            );
          }

          setApplications(result.applications);
        } catch (error) {
          setCopyrightError(
            error instanceof Error ? error.message : "Please try again."
          );
        }
      })(),

      (async () => {
        try {
          const response = await fetch("/api/llc-applications", {
            cache: "no-store",
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.error || "LLC applications could not be loaded."
            );
          }

          setLLCApplications(result.applications);
        } catch (error) {
          setLLCError(
            error instanceof Error ? error.message : "Please try again."
          );
        }
      })(),
    ]);
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
      setApplications([]);
      setLLCApplications([]);
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
      setLLCApplications([]);
      setCopyrightError("");
      setLLCError("");
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sign-out failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function startApplication(kind: "copyright" | "llc") {
    setBusy(true);
    setMessage("");

    const isLLC = kind === "llc";

    try {
      const response = await fetch(
        isLLC ? "/api/llc-applications" : "/api/my-applications",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: isLLC ? "Untitled LLC" : "Untitled application",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Application could not be created."
        );
      }

      const path = isLLC
        ? "/filing-center/hawaii-llc"
        : "/copyright/apply";

      window.location.assign(
        `${path}?application_id=${encodeURIComponent(
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

  function applicationCards(
    items: Application[],
    kind: "copyright" | "llc"
  ) {
    const path =
      kind === "llc"
        ? "/filing-center/hawaii-llc"
        : "/copyright/apply";

    return (
      <div className="applications">
        {items.map((application) => (
          <section className="card" key={application.id}>
            <span className={application.paid ? "badge paid" : "badge"}>
              {application.paid
                ? "Preparation payment received"
                : "Preparation payment needed"}
            </span>

            <h3>{application.title}</h3>

            <p>
              Updated{" "}
              {new Date(application.updatedAt).toLocaleDateString()}
            </p>

            <Link
              href={`${path}?application_id=${encodeURIComponent(
                application.id
              )}`}
            >
              Open {kind === "llc" ? "LLC draft" : "application"}
            </Link>
          </section>
        ))}
      </div>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <nav>
          <Link href="/copyright">← Copyright Center</Link>
          <Link href="/filing-center">Filing Center</Link>
        </nav>

        <header>
          <p className="eyebrow">RAY&apos;SNOTES</p>
          <h1>My Applications</h1>
          <p>
            Keep your copyright and Hawaii LLC preparation drafts
            and payments together in your account.
          </p>
        </header>

        {message && (
          <p role="status" className="message">
            {message}
          </p>
        )}

        {loading ? (
          <p>Loading your account…</p>
        ) : !account ? (
          <section className="card">
            <h2>{register ? "Create your account" : "Sign in"}</h2>
            <p>Return to your saved preparation applications.</p>

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
                  autoComplete={
                    register ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>

              {register && (
                <p>Choose a password with at least 12 characters.</p>
              )}

              <button disabled={busy} type="submit">
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setMessage("");
              }}
            >
              {register
                ? "Already have an account? Sign in"
                : "Create an account"}
            </button>
          </section>
        ) : (
          <>
            <div className="toolbar">
              <p>Signed in as {account.email}</p>
              <button
                className="secondary"
                onClick={signOut}
                disabled={busy}
              >
                Sign out
              </button>
            </div>

            <section className="category">
              <h2>Copyright Applications</h2>

              <button
                onClick={() => startApplication("copyright")}
                disabled={busy}
              >
                + Start Copyright Application
              </button>

              <p className="note">
                Each application has its own preparation payment.
                A preparation summary does not indicate Copyright
                Office registration.
              </p>

              {copyrightError ? (
                <p role="status" className="message">
                  {copyrightError}
                </p>
              ) : applications.length === 0 ? (
                <p>No copyright applications yet.</p>
              ) : (
                applicationCards(applications, "copyright")
              )}
            </section>

            <section className="category">
              <h2>Hawaii LLC Applications</h2>

              <button
                onClick={() => startApplication("llc")}
                disabled={busy}
              >
                + Start Hawaii LLC Draft
              </button>

              <p className="note">
                Preparation costs $24.99 per LLC. That payment
                provides a one-time credit toward the $149
                full-service fee for the same LLC. Government fees
                are separate. A draft or preparation payment does
                not form an LLC.
              </p>

              {llcError ? (
                <p role="status" className="message">
                  {llcError}
                </p>
              ) : llcApplications.length === 0 ? (
                <p>No LLC applications yet.</p>
              ) : (
                applicationCards(llcApplications, "llc")
              )}
            </section>
          </>
        )}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #080f24;
          color: #edf2ff;
          padding: 40px 20px 80px;
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
          margin: 40px 0 30px;
        }

        h1 {
          font-size: clamp(32px, 6vw, 52px);
          margin: 8px 0 16px;
        }

        h2,
        h3 {
          margin: 16px 0;
          overflow-wrap: anywhere;
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

        .category {
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid #344662;
        }

        .note {
          color: #bdcbe1;
          max-width: 760px;
        }

        .applications {
          display: grid;
          grid-template-columns:
            repeat(auto-fit, minmax(min(100%, 260px), 1fr));
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

        .message {
          padding: 16px;
          background: #243650;
          border-radius: 10px;
        }
      `}</style>
    </main>
  );
} 
