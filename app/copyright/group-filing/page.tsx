"use client";

import { useEffect, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";

const PAYMENT_LINK =
  "https://buy.stripe.com/14A8wPbR85RR9jQ9612Nq07";

type UploadedSong = {
  name: string;
  pathname: string;
  url: string;
  contentType: string;
};

type FormData = {
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

const emptyForm: FormData = {
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
  const [form, setForm] = useState<FormData>(emptyForm);
  const [sessionId, setSessionId] = useState("");
  const [paid, setPaid] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedSongs, setUploadedSongs] = useState<UploadedSong[]>([]);
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
    async function verifyPayment() {
      const params = new URLSearchParams(window.location.search);
      const returnedSessionId = params.get("session_id");
      const savedSessionId = localStorage.getItem(
        "raysnotes-group-filing-credit"
      );
      const paymentSession = returnedSessionId || savedSessionId || "";

      if (!paymentSession) {
        setCheckingPayment(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/group-filing-payment?session_id=${encodeURIComponent(
            paymentSession
          )}`
        );

        const data = await response.json();

        if (response.ok && data.paid) {
          setSessionId(paymentSession);
          setPaid(true);
          localStorage.setItem(
            "raysnotes-group-filing-credit",
            paymentSession
          );

          setForm((current) => ({
            ...current,
            email: data.customerEmail || current.email,
            authorName: data.customerName || current.authorName,
            phone: data.customerPhone || current.phone,
          }));
        }
      } catch {
        setMessage("Payment verification could not be completed.");
      } finally {
        setCheckingPayment(false);
      }
    }

    verifyPayment();
  }, []);

  function updateField(
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (files.length > 10) {
      setUploadMessage("Please select no more than 10 files.");
      event.target.value = "";
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
      setUploadMessage("Verified payment is required before uploading.");
      return;
    }

    if (selectedFiles.length < 1 || selectedFiles.length > 10) {
      setUploadMessage("Select between 1 and 10 song files.");
      return;
    }

    if (songs.length !== selectedFiles.length) {
      setUploadMessage(
        "Enter one song title for every selected song file."
      );
      return;
    }

    try {
      setUploading(true);
      setUploadedSongs([]);
      setUploadMessage("Uploading songs securely...");

      const completed: UploadedSong[] = [];

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        const safeName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(-120);

        setUploadMessage(
          `Uploading song ${index + 1} of ${selectedFiles.length}...`
        );

        const blob = await uploadPresigned(
          `group-filing/${sessionId}/${Date.now()}-${
            index + 1
          }-${safeName}`,
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
      setUploadedSongs([]);
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "The song upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setReference("");

    if (!paid || !sessionId) {
      setMessage("Verified payment is required.");
      return;
    }

    if (songs.length < 1 || songs.length > 10) {
      setMessage("Enter between 1 and 10 song titles.");
      return;
    }

    if (uploadedSongs.length !== songs.length) {
      setMessage(
        "Upload one song file for every song title before submitting."
      );
      return;
    }

    if (!eligible || !authorized) {
      setMessage("Please complete both required confirmations.");
      return;
    }

    if (
      form.signature.trim().toLowerCase() !==
      form.authorName.trim().toLowerCase()
    ) {
      setMessage(
        "The electronic signature must match the author's legal name."
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/group-filing-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          songTitles: songs,
          depositFiles: uploadedSongs,
          sessionId,
          eligibilityConfirmed: eligible,
          authorizationConfirmed: authorized,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The request could not be submitted.");
      }

      setReference(data.reference);
      setMessage(
        "Your filing request and private song files were received."
      );
      localStorage.removeItem("raysnotes-group-filing-credit");
      localStorage.removeItem("raysnotes-group-filing-draft");
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

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(145deg, #071426 0%, #0b2440 48%, #06111f 100%)",
        color: "white",
        padding: "42px 18px 80px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>
        <p
          style={{
            color: "#4df58b",
            fontWeight: 800,
            letterSpacing: 3,
          }}
        >
          FULL-SERVICE GROUP FILING
        </p>

        <h1
          style={{
            fontSize: "clamp(42px, 7vw, 78px)",
            lineHeight: 1.02,
            margin: "10px 0 18px",
          }}
        >
          Register Up to 10 Unpublished Songs
        </h1>

        <p style={{ fontSize: 20, color: "#d7e6f5" }}>
          Ray&apos;sNotes prepares and manually submits an eligible group
          application after reviewing your information and deposits.
        </p>

        <section
          style={{
            marginTop: 35,
            padding: 32,
            borderRadius: 18,
            background: "white",
            color: "#122033",
            textAlign: "center",
            border: "3px solid #f0a12a",
          }}
        >
          <h2 style={{ fontSize: 38, margin: 0 }}>$159 total</h2>

          <p style={{ fontSize: 18, fontWeight: 700 }}>
            $74 Ray&apos;sNotes service fee + $85 U.S. Copyright Office
            filing fee
          </p>

          <p style={{ color: "#4b5563" }}>
            The government fee is paid to the Copyright Office after
            eligibility review. Registration is not guaranteed. No legal
            advice.
          </p>

          {!paid && (
            <a
              href={PAYMENT_LINK}
              style={{
                display: "inline-block",
                marginTop: 10,
                padding: "17px 28px",
                borderRadius: 12,
                background: "#0797e8",
                color: "white",
                textDecoration: "none",
                fontSize: 19,
                fontWeight: 800,
              }}
            >
              Purchase Full-Service Group Filing — $159
            </a>
          )}

          {checkingPayment && <p>Checking payment...</p>}

          {paid && (
            <p
              style={{
                color: "#08783f",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              ✓ Payment verified — complete the form and upload your songs
            </p>
          )}
        </section>

        <form
          onSubmit={submitRequest}
          style={{
            marginTop: 28,
            padding: 28,
            borderRadius: 18,
            background: "white",
            color: "#122033",
            opacity: paid ? 1 : 0.55,
          }}
        >
          <fieldset
            disabled={!paid || submitting}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <h2>1. Author and claimant</h2>

            <label style={labelStyle}>
              Author&apos;s full legal name
              <input
                required
                name="authorName"
                value={form.authorName}
                onChange={updateField}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Copyright claimant&apos;s legal name
              <input
                required
                name="claimantName"
                value={form.claimantName}
                onChange={updateField}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Citizenship or domicile
              <input
                required
                name="citizenship"
                value={form.citizenship}
                onChange={updateField}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Was this created as work made for hire?
              <select
                required
                name="workForHire"
                value={form.workForHire}
                onChange={updateField}
                style={inputStyle}
              >
                <option value="">Choose one</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
                <option value="Not sure">Not sure</option>
              </select>
            </label>

            <h2 style={{ marginTop: 38 }}>2. Songs and authorship</h2>

            <label style={labelStyle}>
              Song titles — enter one title per line
              <textarea
                required
                name="songTitles"
                value={form.songTitles}
                onChange={updateField}
                rows={7}
                placeholder={"Song One\nSong Two\nSong Three"}
                style={inputStyle}
              />
            </label>

            <p>
              Songs entered: <strong>{songs.length}</strong> of 10
            </p>

            <label style={labelStyle}>
              What are you registering?
              <select
                required
                name="authorshipType"
                value={form.authorshipType}
                onChange={updateField}
                style={inputStyle}
              >
                <option value="">Choose one</option>
                <option value="Music and lyrics">Music and lyrics</option>
                <option value="Music only">Music only</option>
                <option value="Lyrics only">Lyrics only</option>
                <option value="Sound recordings and compositions">
                  Sound recordings and compositions
                </option>
              </select>
            </label>

            <label style={labelStyle}>
              Coauthors, samples, purchased beats, or preexisting material
              <textarea
                name="notes"
                value={form.notes}
                onChange={updateField}
                rows={5}
                placeholder="Explain anything Ray'sNotes should review."
                style={inputStyle}
              />
            </label>

            <h2 style={{ marginTop: 38 }}>
              3. Securely upload your songs
            </h2>

            <p>
              Select one audio file for each title, in the same order.
              You may also upload PDF or text lyric deposits.
            </p>

            <input
              type="file"
              multiple
              accept="audio/*,.pdf,.txt"
              onChange={chooseFiles}
              style={{ margin: "12px 0", fontSize: 16 }}
            />

            <p>
              Selected: <strong>{selectedFiles.length}</strong> file(s)
            </p>

            <button
              type="button"
              onClick={uploadSongs}
              disabled={
                uploading ||
                selectedFiles.length < 1 ||
                selectedFiles.length > 10
              }
              style={secondaryButtonStyle}
            >
              {uploading ? "Uploading securely..." : "Upload Songs"}
            </button>

            {uploadMessage && (
              <p style={{ fontWeight: 700 }}>{uploadMessage}</p>
            )}

            {uploadedSongs.length > 0 && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: "#eafaf1",
                  marginTop: 15,
                }}
              >
                <strong>Private uploads completed:</strong>
                <ol>
                  {uploadedSongs.map((song) => (
                    <li key={song.pathname}>{song.name}</li>
                  ))}
                </ol>
              </div>
            )}

            <h2 style={{ marginTop: 38 }}>4. Contact information</h2>

            <label style={labelStyle}>
              Email address
              <input
                required
                type="email"
                name="email"
                value={form.email}
                onChange={updateField}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Phone number
              <input
                required
                type="tel"
                name="phone"
                value={form.phone}
                onChange={updateField}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Complete mailing address
              <textarea
                required
                name="address"
                value={form.address}
                onChange={updateField}
                rows={4}
                style={inputStyle}
              />
            </label>

            <h2 style={{ marginTop: 38 }}>
              5. Confirmations and signature
            </h2>

            <label style={checkStyle}>
              <input
                required
                type="checkbox"
                checked={eligible}
                onChange={(event) => setEligible(event.target.checked)}
              />
              <span>
                I confirm that all works are unpublished, there are no more
                than 10 works, and the claimant or joint claimants are the
                same for every work.
              </span>
            </label>

            <label style={checkStyle}>
              <input
                required
                type="checkbox"
                checked={authorized}
                onChange={(event) => setAuthorized(event.target.checked)}
              />
              <span>
                I authorize Ray&apos;sNotes to prepare and submit this
                application using the information and files I provide. I
                understand registration is not guaranteed and this service
                does not provide legal advice.
              </span>
            </label>

            <label style={labelStyle}>
              Electronic signature — type the author&apos;s full legal name
              <input
                required
                name="signature"
                value={form.signature}
                onChange={updateField}
                style={inputStyle}
              />
            </label>

            <button
              type="submit"
              disabled={submitting || uploadedSongs.length !== songs.length}
              style={primaryButtonStyle}
            >
              {submitting
                ? "Submitting securely..."
                : "Submit Filing Request"}
            </button>

            {message && (
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 10,
                  background: reference ? "#eafaf1" : "#fff2f2",
                  fontWeight: 700,
                }}
              >
                <p>{message}</p>
                {reference && (
                  <p>
                    Reference number: <strong>{reference}</strong>
                  </p>
                )}
              </div>
            )}
          </fieldset>
        </form>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  margin: "18px 0",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 13,
  border: "2px solid #9aa8b8",
  borderRadius: 8,
  fontSize: 16,
  fontFamily: "Arial, sans-serif",
};

const checkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  margin: "20px 0",
  lineHeight: 1.5,
  fontWeight: 600,
};

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 22,
  padding: "16px 25px",
  border: 0,
  borderRadius: 10,
  background: "#087fdd",
  color: "white",
  fontSize: 18,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "13px 22px",
  border: 0,
  borderRadius: 9,
  background: "#136f46",
  color: "white",
  fontSize: 17,
  fontWeight: 800,
  cursor: "pointer",
}; 
