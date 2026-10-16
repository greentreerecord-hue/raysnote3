"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import { uploadPresigned } from "@vercel/blob/client";

const PAYMENT_LINK =
  "https://buy.stripe.com/14A8wPbR85RR9jQ9612Nq07";

type UploadedSong = {
  name: string;
  pathname: string;
  url: string;
  contentType: string;
};

type FilingForm = {
  authorName: string;
  claimantName: string;
  citizenship: string;
  workForHire: string;
  songTitles: string;
  authorshipType: string;
  notes: string;
  email: string;
  phone: string;
  address: string;
  signature: string;
};

const emptyForm: FilingForm = {
  authorName: "",
  claimantName: "",
  citizenship: "",
  workForHire: "",
  songTitles: "",
  authorshipType: "",
  notes: "",
  email: "",
  phone: "",
  address: "",
  signature: "",
};

export default function GroupFilingPage() {
  const [form, setForm] = useState<FilingForm>(emptyForm);
  const [sessionId, setSessionId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [applicationTitle, setApplicationTitle] = useState("");
  const [upgrade, setUpgrade] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [sameWork, setSameWork] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedSongs, setUploadedSongs] =
    useState<UploadedSong[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");

  const songs = form.songTitles
    .split("\n")
    .map((title) => title.trim())
    .filter(Boolean);

  useEffect(() => {
    let active = true;

    async function load() {
      const params = new URLSearchParams(window.location.search);
      const requestedApplication = params.get("application_id") || "";
      const returnedSession = params.get("session_id") || "";

      setApplicationId(requestedApplication);

      try {
        let savedSession = "";

        try {
          savedSession = localStorage.getItem(
            requestedApplication
              ? `raysnotes-group-upgrade-${requestedApplication}`
              : "raysnotes-group-filing-credit"
          ) || "";
        } catch {
          // Payment can still be verified from the return URL.
        }

        const paymentSession = returnedSession || savedSession;

        if (!paymentSession) {
          if (requestedApplication && active) {
            setMessage(
              "Open the upgrade from your saved preparation application."
            );
          }
          return;
        }

        const response = await fetch(
          `/api/group-filing-payment?session_id=${encodeURIComponent(paymentSession)}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || data.paid !== true) {
          throw new Error(
            data.error ||
              "Payment could not be verified. Do not pay again."
          );
        }

        const linkedApplication =
          typeof data.applicationId === "string"
            ? data.applicationId
            : "";

        if (
          requestedApplication &&
          requestedApplication !== linkedApplication
        ) {
          throw new Error(
            "This payment belongs to a different application."
          );
        }

        if (!active) return;

        setSessionId(paymentSession);
        setApplicationId(linkedApplication);
        setUpgrade(Boolean(linkedApplication));
        setPaid(true);

        setForm((current) => ({
          ...current,
          email: data.customerEmail || current.email,
          authorName: data.customerName || current.authorName,
          phone: data.customerPhone || current.phone,
        }));

        try {
          localStorage.setItem(
            linkedApplication
              ? `raysnotes-group-upgrade-${linkedApplication}`
              : "raysnotes-group-filing-credit",
            paymentSession
          );
        } catch {
          // Browser storage is optional.
        }

        if (linkedApplication) {
          const draftResponse = await fetch(
            `/api/my-applications?application_id=${encodeURIComponent(linkedApplication)}`,
            { cache: "no-store" }
          );

          const draftData = await draftResponse.json();

          if (!draftResponse.ok) {
            throw new Error(
              "Payment verified, but preparation details could not be loaded. You can enter them below."
            );
          }

          if (!active) return;

          const draft = draftData.application.form || {};

          setApplicationTitle(
            draftData.application.title || draft.title || ""
          );

          setForm((current) => ({
            ...current,
            authorName: draft.authorName || current.authorName,
            claimantName: draft.claimantName || "",
            citizenship: draft.citizenship || "",
            workForHire: draft.workForHire || "",
            email: draft.email || current.email,
            phone: draft.phone || current.phone,
            address: draft.address || "",
            authorshipType:
              draft.workType === "Music and lyrics"
                ? "Music and lyrics"
                : "",
            notes: [
              draft.preexistingMaterial
                ? `Preexisting material: ${draft.preexistingMaterial}`
                : "",
              draft.newMaterial
                ? `New material: ${draft.newMaterial}`
                : "",
            ].filter(Boolean).join("\n"),
          }));
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Payment verification could not be completed."
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

  function updateField(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (name === "songTitles") {
      setUploadedSongs([]);
      setUploadMessage(
        "Song titles changed. Upload files in the matching title order."
      );
    }
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (files.length > 10) {
      setUploadMessage("Please select no more than 10 files.");
      event.target.value = "";
      setSelectedFiles([]);
      setUploadedSongs([]);
      return;
    }

    setSelectedFiles(files);
    setUploadedSongs([]);
    setUploadMessage(
      files.length
        ? `${files.length} file(s) selected. Click Upload Songs.`
        : ""
    );
  }

  async function uploadSongs() {
    if (!paid || !sessionId) {
      setUploadMessage("Verified payment is required.");
      return;
    }

    if (
      selectedFiles.length < 1 ||
      selectedFiles.length > 10 ||
      selectedFiles.length !== songs.length
    ) {
      setUploadMessage(
        "Enter between 1 and 10 titles and select one file per title."
      );
      return;
    }

    setUploading(true);
    setUploadedSongs([]);

    try {
      const completed: UploadedSong[] = [];

      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        const safeName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(-120);

        setUploadMessage(
          `Uploading song ${index + 1} of ${selectedFiles.length}…`
        );

        const blob = await uploadPresigned(
          `group-filing/${sessionId}/${Date.now()}-${index + 1}-${safeName}`,
          file,
          {
            access: "private",
            handleUploadUrl: "/api/group-filing-upload",
            clientPayload: JSON.stringify({ sessionId }),
            multipart: true,
          }
        );

        completed.push({
          name: file.name,
          pathname: blob.pathname,
          url: blob.url,
          contentType: blob.contentType,
        });
      }

      setUploadedSongs(completed);
      setUploadMessage(
        `${completed.length} song file(s) uploaded securely.`
      );
    } catch (error) {
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "The song upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!paid || !sessionId) {
      setMessage("Verified payment is required.");
      return;
    }

    if (
      songs.length < 1 ||
      songs.length > 10 ||
      uploadedSongs.length !== songs.length
    ) {
      setMessage("Upload one file for each of 1–10 song titles.");
      return;
    }

    if (!eligible || !authorized || (upgrade && !sameWork)) {
      setMessage("Please complete all required confirmations.");
      return;
    }

    if (
      form.signature.trim().toLowerCase() !==
      form.authorName.trim().toLowerCase()
    ) {
      setMessage(
        "The signature must match the author's full legal name."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/group-filing-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          songTitles: songs,
          depositFiles: uploadedSongs,
          sessionId,
          applicationId: applicationId || undefined,
          sameWorkConfirmed: upgrade ? sameWork : undefined,
          eligibilityConfirmed: eligible,
          authorizationConfirmed: authorized,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "The request could not be submitted."
        );
      }

      setReference(data.reference);
      setMessage(
        data.existing
          ? "This filing request was already received."
          : "Your filing request and private song files were received."
      );

      try {
        localStorage.removeItem(
          upgrade
            ? `raysnotes-group-upgrade-${applicationId}`
            : "raysnotes-group-filing-credit"
        );
      } catch {
        // The server has already saved the request.
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The request could not be submitted."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function input(
    name: keyof FilingForm,
    label: string,
    type = "text"
  ) {
    return (
      <label>
        {label}
        <input
          required
          type={type}
          name={name}
          value={form[name]}
          onChange={updateField}
          maxLength={500}
        />
      </label>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <nav>
          <Link href="/copyright">← Copyright Center</Link>
          <Link href="/my-applications">My Applications</Link>
        </nav>

        <p className="eyebrow">FULL-SERVICE GROUP FILING</p>
        <h1>Register Up to 10 Unpublished Songs</h1>

        <p>
          Ray&apos;sNotes prepares and manually submits an eligible
          group application after reviewing your information and deposits.
        </p>

        <section className="card payment">
          <h2>$159 total package</h2>
          <p>
            $74 Ray&apos;sNotes service fee + $85 government filing fee.
          </p>

          {upgrade && (
            <div className="credit">
              <p>Preparation credit: <strong>$24.99</strong></p>
              <p>Upgrade payment: <strong>$134.01</strong></p>
              <p>
                Linked preparation:{" "}
                <strong>{applicationTitle || applicationId}</strong>
              </p>
            </div>
          )}

          <p>
            The government fee is paid after eligibility review.
            Registration is not guaranteed. No legal advice.
          </p>

          {checking ? (
            <p>Checking payment…</p>
          ) : paid ? (
            <p className="success">
              ✓ Payment verified. Complete the form and upload your songs.
            </p>
          ) : applicationId ? (
            <Link
              className="button"
              href={`/copyright/apply?application_id=${encodeURIComponent(applicationId)}`}
            >
              Return to Preparation and Open Upgrade
            </Link>
          ) : (
            <>
              <a className="button" href={PAYMENT_LINK}>
                Purchase Full-Service Group Filing — $159
              </a>
              <p>
                Already purchased preparation? Open your application
                to use its upgrade credit.
              </p>
              <Link href="/my-applications">Open My Applications</Link>
            </>
          )}
        </section>

        {message && (
          <section className="message" role="status">
            <p>{message}</p>
            {reference && (
              <p>Reference: <strong>{reference}</strong></p>
            )}
          </section>
        )}

        {!reference && (
          <form onSubmit={submitRequest} className="card">
            <fieldset
              disabled={!paid || checking || submitting || uploading}
            >
              <h2>1. Author and claimant</h2>
              {input("authorName", "Author’s full legal name")}
              {input("claimantName", "Copyright claimant’s legal name")}
              {input("citizenship", "Citizenship or domicile")}

              <label>
                Was this created as work made for hire?
                <select
                  required
                  name="workForHire"
                  value={form.workForHire}
                  onChange={updateField}
                >
                  <option value="">Choose one</option>
                  <option>No</option>
                  <option>Yes</option>
                  <option>Not sure</option>
                </select>
              </label>

              <h2>2. Songs and authorship</h2>

              {upgrade && (
                <p>
                  Enter the individual song titles from the same work
                  or album as your linked preparation application.
                </p>
              )}

              <label>
                Song titles — one title per line
                <textarea
                  required
                  name="songTitles"
                  value={form.songTitles}
                  onChange={updateField}
                  rows={7}
                  maxLength={5000}
                  placeholder={"Song One\nSong Two"}
                />
              </label>

              <p>Songs entered: <strong>{songs.length}</strong> of 10</p>

              <label>
                What are you registering?
                <select
                  required
                  name="authorshipType"
                  value={form.authorshipType}
                  onChange={updateField}
                >
                  <option value="">Choose one</option>
                  <option>Music and lyrics</option>
                  <option>Music only</option>
                  <option>Lyrics only</option>
                  <option>Sound recordings and compositions</option>
                </select>
              </label>

              <label>
                Coauthors, samples, purchased beats, or preexisting material
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={updateField}
                  rows={5}
                  maxLength={10000}
                />
              </label>

              <h2>3. Securely upload your songs</h2>
              <p>
                Select one file per title in the same order.
                Audio, PDF, and text deposits are supported.
              </p>

              <input
                type="file"
                multiple
                accept="audio/*,.pdf,.txt"
                onChange={chooseFiles}
              />

              <p>Selected: {selectedFiles.length} file(s)</p>

              <button
                type="button"
                onClick={uploadSongs}
                disabled={selectedFiles.length < 1}
              >
                Upload Songs
              </button>

              {uploadedSongs.length > 0 && (
                <ol>
                  {uploadedSongs.map((song, index) => (
                    <li key={song.pathname}>
                      {songs[index]} — {song.name}
                    </li>
                  ))}
                </ol>
              )}

              <h2>4. Contact information</h2>
              {input("email", "Email address", "email")}
              {input("phone", "Phone number", "tel")}

              <label>
                Complete mailing address
                <textarea
                  required
                  name="address"
                  value={form.address}
                  onChange={updateField}
                  rows={4}
                  maxLength={5000}
                />
              </label>

              <h2>5. Confirmations and signature</h2>

              {upgrade && (
                <label className="check">
                  <input
                    required
                    type="checkbox"
                    checked={sameWork}
                    onChange={(event) => setSameWork(event.target.checked)}
                  />
                  <span>
                    These songs belong to the same work or album as
                    my linked preparation application. I am applying
                    its $24.99 credit to this filing only.
                  </span>
                </label>
              )}

              <label className="check">
                <input
                  required
                  type="checkbox"
                  checked={eligible}
                  onChange={(event) => setEligible(event.target.checked)}
                />
                <span>
                  All works are unpublished, there are no more than
                  10 works, and the claimant or joint claimants are
                  the same for every work. I understand Ray&apos;sNotes
                  must review all eligibility requirements.
                </span>
              </label>

              <label className="check">
                <input
                  required
                  type="checkbox"
                  checked={authorized}
                  onChange={(event) => setAuthorized(event.target.checked)}
                />
                <span>
                  I authorize Ray&apos;sNotes to prepare and submit
                  this application using my information and files.
                  Registration is not guaranteed, and this service
                  does not provide legal advice.
                </span>
              </label>

              {input(
                "signature",
                "Electronic signature — author’s full legal name"
              )}

              <button
                type="submit"
                disabled={
                  songs.length < 1 ||
                  songs.length > 10 ||
                  uploadedSongs.length !== songs.length
                }
              >
                {submitting ? "Submitting…" : "Submit Filing Request"}
              </button>
            </fieldset>
          </form>
        )}

        {uploadMessage && (
          <p className="message" role="status">{uploadMessage}</p>
        )}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: linear-gradient(145deg, #071426, #0b2440);
          color: white;
          padding: 36px 18px 80px;
          font-family: Arial, sans-serif;
        }
        .container { max-width: 1050px; margin: auto; }
        nav { display: flex; flex-wrap: wrap; gap: 24px; }
        nav :global(a) { color: #67e8f9; }
        .eyebrow {
          margin-top: 36px;
          color: #4df58b;
          font-weight: 800;
          letter-spacing: 3px;
        }
        h1 { font-size: clamp(36px, 6vw, 66px); }
        h2 { margin: 32px 0 18px; }
        .card h2:first-child { margin-top: 0; }
        p { line-height: 1.6; }
        .card {
          margin-top: 28px;
          padding: 28px;
          border-radius: 18px;
          background: white;
          color: #122033;
        }
        .payment { text-align: center; border: 3px solid #f0a12a; }
        .credit {
          padding: 14px;
          background: #eafaf1;
          border-radius: 12px;
          overflow-wrap: anywhere;
        }
        .success { color: #08783f; font-weight: 800; }
        fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
        label { display: grid; gap: 8px; margin: 18px 0; font-weight: 700; }
        input, select, textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 13px;
          border: 2px solid #9aa8b8;
          border-radius: 8px;
          font: inherit;
          background: white;
          color: #122033;
        }
        textarea { resize: vertical; }
        .check {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          line-height: 1.5;
        }
        .check input { width: 20px; height: 20px; flex-shrink: 0; }
        button, .payment :global(.button) {
          display: inline-block;
          padding: 16px 24px;
          border: 0;
          border-radius: 10px;
          background: #087fdd;
          color: white;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
          text-decoration: none;
        }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .message {
          padding: 18px;
          margin-top: 24px;
          border-radius: 12px;
          background: #243650;
          overflow-wrap: anywhere;
        }
        li { margin: 10px 0; overflow-wrap: anywhere; }
      `}</style>
    </main>
  );
} 
