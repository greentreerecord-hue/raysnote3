"use client";

import { useEffect, useState } from "react";

type CopyrightRecord = {
  id: string;
  creatorName: string;
  email: string;
  workTitle: string;
  workType: string;
  description: string;
  creationDate: string;
  fileName: string;
  fileSize: number;
  fingerprint: string;
  recordedAt: string;
};

const STORAGE_KEY = "raysnotes-copyright-records";

export default function CopyrightCenterPage() {
  const [creatorName, setCreatorName] = useState("");
  const [email, setEmail] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [workType, setWorkType] = useState(
    "Song or Music"
  );
  const [description, setDescription] = useState("");
  const [creationDate, setCreationDate] = useState("");
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [records, setRecords] = useState<
    CopyrightRecord[]
  >([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const savedRecords =
        localStorage.getItem(STORAGE_KEY);

      if (savedRecords) {
        setRecords(JSON.parse(savedRecords));
      }
    } catch {
      setMessage(
        "Your saved creation records could not be loaded."
      );
    }
  }, []);

  function createRecordId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }

    return `RN-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  async function createFingerprint(
    recordId: string
  ): Promise<string> {
    let data: ArrayBuffer;

    if (selectedFile) {
      data = await selectedFile.arrayBuffer();
    } else {
      const recordText = [
        recordId,
        creatorName.trim(),
        email.trim().toLowerCase(),
        workTitle.trim(),
        workType,
        description.trim(),
        creationDate,
      ].join("|");

      data = new TextEncoder().encode(
        recordText
      ).buffer;
    }

    const digest = await crypto.subtle.digest(
      "SHA-256",
      data
    );

    return Array.from(new Uint8Array(digest))
      .map((byte) =>
        byte.toString(16).padStart(2, "0")
      )
      .join("");
  }

  async function saveRecord(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !creatorName.trim() ||
      !workTitle.trim() ||
      !creationDate
    ) {
      setMessage(
        "Please enter the creator name, work title, and creation date."
      );
      return;
    }

    try {
      setSaving(true);
      setMessage(
        "Creating your private creation record..."
      );

      const id = createRecordId();
      const fingerprint =
        await createFingerprint(id);

      const newRecord: CopyrightRecord = {
        id,
        creatorName: creatorName.trim(),
        email: email.trim().toLowerCase(),
        workTitle: workTitle.trim(),
        workType,
        description: description.trim(),
        creationDate,
        fileName: selectedFile?.name ?? "",
        fileSize: selectedFile?.size ?? 0,
        fingerprint,
        recordedAt: new Date().toISOString(),
      };

      const updatedRecords = [
        newRecord,
        ...records,
      ];

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedRecords)
      );

      setRecords(updatedRecords);
      setWorkTitle("");
      setDescription("");
      setCreationDate("");
      setSelectedFile(null);

      const fileInput = document.getElementById(
        "copyright-file"
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      setMessage(
        "Creation record saved privately on this device."
      );
    } catch {
      setMessage(
        "The creation record could not be saved. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function downloadCertificate(
    record: CopyrightRecord
  ) {
    const fileSizeText = record.fileSize
      ? `${record.fileSize.toLocaleString()} bytes`
      : "Not available";

    const certificate = [
      "RAY'SNOTES CREATION RECORD",
      "==========================",
      "",
      `Record ID: ${record.id}`,
      `Recorded: ${new Date(
        record.recordedAt
      ).toLocaleString()}`,
      "",
      `Creator: ${record.creatorName}`,
      `Email: ${record.email || "Not provided"}`,
      `Work title: ${record.workTitle}`,
      `Work type: ${record.workType}`,
      `Creation date: ${record.creationDate}`,
      `Description: ${
        record.description || "None"
      }`,
      `Original file: ${
        record.fileName || "Not attached"
      }`,
      `File size: ${fileSizeText}`,
      "",
      "SHA-256 DIGITAL FINGERPRINT",
      record.fingerprint,
      "",
      "IMPORTANT NOTICE",
      "This Ray'sNotes creation record documents information entered by the user.",
      "It is not registration with the United States Copyright Office.",
      "It does not prove ownership by itself and is not legal advice.",
      "",
      "Official copyright registration:",
      "https://www.copyright.gov/registration/",
    ].join("\n");

    const blob = new Blob([certificate], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${record.workTitle
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()}-creation-record.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function deleteRecord(recordId: string) {
    const confirmed = window.confirm(
      "Delete this creation record from this device?"
    );

    if (!confirmed) {
      return;
    }

    const updatedRecords = records.filter(
      (record) => record.id !== recordId
    );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedRecords)
    );

    setRecords(updatedRecords);
    setMessage("Creation record deleted.");
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <nav style={styles.navigation}>
          <a href="/" style={styles.homeButton}>
            ← Ray&apos;sNotes Home
          </a>
        </nav>

        <header style={styles.hero}>
          <div style={styles.copyrightIcon}>
            ©
          </div>

          <div>
            <p style={styles.eyebrow}>
              PROTECT YOUR CREATIVE WORK
            </p>

            <h1 style={styles.heading}>
              Ray&apos;sNotes Copyright Center
            </h1>

            <p style={styles.subtitle}>
              Create a private record of your
              original writing, music, artwork,
              photography, video, software, or
              other creative work.
            </p>
          </div>
        </header>

        <section style={styles.notice}>
          <h2 style={styles.noticeHeading}>
            Important Copyright Notice
          </h2>

          <p style={styles.noticeText}>
            A Ray&apos;sNotes Creation Record is
            not a registration with the United
            States Copyright Office and does not
            replace legal advice. This tool records
            the information you provide and creates
            a digital fingerprint for your work.
          </p>

          <a
            href="https://www.copyright.gov/registration/"
            target="_blank"
            rel="noreferrer"
            style={styles.officialLink}
          >
            Visit the U.S. Copyright Office ↗
          </a>
        </section>

        <section style={styles.formPanel}>
          <h2 style={styles.sectionHeading}>
            Create a Creation Record
          </h2>

          <p style={styles.privateMessage}>
            🔒 Your information and saved records
            stay in this browser on this device.
          </p>

          <form onSubmit={saveRecord}>
            <div style={styles.formGrid}>
              <label style={styles.label}>
                Creator or legal name *
                <input
                  type="text"
                  value={creatorName}
                  onChange={(event) =>
                    setCreatorName(
                      event.target.value
                    )
                  }
                  placeholder="Enter the creator's name"
                  style={styles.input}
                  required
                />
              </label>

              <label style={styles.label}>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Enter an email address"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Work title *
                <input
                  type="text"
                  value={workTitle}
                  onChange={(event) =>
                    setWorkTitle(
                      event.target.value
                    )
                  }
                  placeholder="Enter the title of your work"
                  style={styles.input}
                  required
                />
              </label>

              <label style={styles.label}>
                Type of work *
                <select
                  value={workType}
                  onChange={(event) =>
                    setWorkType(event.target.value)
                  }
                  style={styles.input}
                >
                  <option>Song or Music</option>
                  <option>Written Work</option>
                  <option>Photograph</option>
                  <option>Artwork</option>
                  <option>Video</option>
                  <option>Software</option>
                  <option>
                    Other Creative Work
                  </option>
                </select>
              </label>

              <label style={styles.label}>
                Date created *
                <input
                  type="date"
                  value={creationDate}
                  onChange={(event) =>
                    setCreationDate(
                      event.target.value
                    )
                  }
                  style={styles.input}
                  required
                />
              </label>

              <label style={styles.label}>
                Original file
                <input
                  id="copyright-file"
                  type="file"
                  onChange={(event) =>
                    setSelectedFile(
                      event.target.files?.[0] ??
                        null
                    )
                  }
                  style={styles.fileInput}
                />

                <span style={styles.helpText}>
                  The file is read only to create
                  its digital fingerprint. This
                  version does not upload the file.
                </span>
              </label>
            </div>

            <label style={styles.label}>
              Description of the work
              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="Describe the work and how it was created"
                rows={5}
                style={styles.textarea}
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...styles.saveButton,
                opacity: saving ? 0.65 : 1,
              }}
            >
              {saving
                ? "Creating Record..."
                : "Create Private Record"}
            </button>

            {message && (
              <p style={styles.message}>
                {message}
              </p>
            )}
          </form>
        </section>

        <section style={styles.recordsPanel}>
          <h2 style={styles.sectionHeading}>
            My Saved Creation Records
          </h2>

          {records.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>
                📄
              </div>

              <h3>No creation records yet</h3>

              <p>
                Complete the form above to create
                your first private record.
              </p>
            </div>
          ) : (
            <div style={styles.recordGrid}>
              {records.map((record) => (
                <article
                  key={record.id}
                  style={styles.recordCard}
                >
                  <span style={styles.workBadge}>
                    {record.workType}
                  </span>

                  <h3 style={styles.recordTitle}>
                    {record.workTitle}
                  </h3>

                  <p style={styles.recordCreator}>
                    Created by {record.creatorName}
                  </p>

                  <p style={styles.recordDetail}>
                    Creation date:{" "}
                    {record.creationDate}
                  </p>

                  <p style={styles.recordDetail}>
                    Recorded:{" "}
                    {new Date(
                      record.recordedAt
                    ).toLocaleString()}
                  </p>

                  {record.fileName && (
                    <p style={styles.recordDetail}>
                      File: {record.fileName}
                    </p>
                  )}

                  <div
                    style={styles.fingerprintBox}
                  >
                    <strong>
                      SHA-256 digital fingerprint
                    </strong>

                    <code
                      style={styles.fingerprint}
                    >
                      {record.fingerprint}
                    </code>
                  </div>

                  <div style={styles.buttonRow}>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCertificate(
                          record
                        )
                      }
                      style={
                        styles.downloadButton
                      }
                    >
                      Download Record
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteRecord(record.id)
                      }
                      style={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer style={styles.footer}>
          © 2026 Ray&apos;sNotes Copyright Center
        </footer>
      </div>
    </main>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    padding: "24px 16px 50px",
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #07111f, #14254d, #30105c)",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    width: "min(1100px, 100%)",
    margin: "0 auto",
  },
  navigation: {
    marginBottom: 22,
  },
  homeButton: {
    display: "inline-block",
    padding: "11px 18px",
    color: "#ffffff",
    border: "3px solid #ffffff",
    borderRadius: 14,
    textDecoration: "none",
    fontWeight: 900,
  },
  hero: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    padding: "34px 20px",
    textAlign: "center",
    border: "4px solid #37d67a",
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #172a67, #651c88)",
  },
  copyrightIcon: {
    display: "grid",
    placeItems: "center",
    flex: "0 0 100px",
    width: 100,
    height: 100,
    color: "#111111",
    background: "#37d67a",
    border: "5px solid #ffffff",
    borderRadius: "50%",
    fontSize: 66,
    fontWeight: 900,
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#7dffad",
    fontWeight: 900,
    letterSpacing: 2,
  },
  heading: {
    margin: 0,
    fontSize: "clamp(36px, 7vw, 66px)",
  },
  subtitle: {
    maxWidth: 720,
    margin: "14px auto 0",
    fontSize: 19,
    lineHeight: 1.5,
    fontWeight: 700,
  },
  notice: {
    margin: "26px 0",
    padding: 22,
    color: "#111111",
    background: "#fff4cf",
    border: "4px solid #f5a300",
    borderRadius: 20,
  },
  noticeHeading: {
    margin: "0 0 10px",
    fontSize: 27,
  },
  noticeText: {
    margin: "0 0 14px",
    fontSize: 17,
    lineHeight: 1.55,
    fontWeight: 700,
  },
  officialLink: {
    display: "inline-block",
    padding: "11px 16px",
    color: "#ffffff",
    background: "#173e9a",
    border: "3px solid #111111",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 900,
  },
  formPanel: {
    padding: 25,
    color: "#111111",
    background: "#ffffff",
    border: "4px solid #37d67a",
    borderRadius: 22,
  },
  recordsPanel: {
    marginTop: 30,
    padding: 25,
    color: "#111111",
    background: "#f6f8ff",
    border: "4px solid #7f55e8",
    borderRadius: 22,
  },
  sectionHeading: {
    margin: "0 0 12px",
    fontSize: 32,
  },
  privateMessage: {
    margin: "0 0 22px",
    padding: 12,
    color: "#075b30",
    background: "#dcffea",
    border: "2px solid #159650",
    borderRadius: 10,
    fontWeight: 800,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 18,
  },
  label: {
    display: "grid",
    gap: 7,
    marginBottom: 18,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 13,
    color: "#111111",
    background: "#ffffff",
    border: "3px solid #111111",
    borderRadius: 11,
    fontSize: 16,
  },
  fileInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: 10,
    color: "#111111",
    background: "#f3f3f3",
    border: "3px solid #111111",
    borderRadius: 11,
  },
  helpText: {
    color: "#555555",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 600,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: 13,
    color: "#111111",
    background: "#ffffff",
    border: "3px solid #111111",
    borderRadius: 11,
    fontFamily: "Arial, sans-serif",
    fontSize: 16,
    resize: "vertical",
  },
  saveButton: {
    width: "100%",
    padding: 15,
    color: "#ffffff",
    background: "#087c42",
    border: "3px solid #111111",
    borderRadius: 13,
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
  },
  message: {
    margin: "16px 0 0",
    padding: 12,
    color: "#172a67",
    background: "#e6edff",
    borderRadius: 10,
    textAlign: "center",
    fontWeight: 900,
  },
  empty: {
    padding: 30,
    background: "#ffffff",
    border: "3px dashed #777777",
    borderRadius: 16,
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: 55,
  },
  recordGrid: {
    display: "grid",
    gap: 18,
  },
  recordCard: {
    padding: 20,
    background: "#ffffff",
    border: "3px solid #111111",
    borderRadius: 16,
    boxShadow: "0 8px 20px rgba(0,0,0,.15)",
  },
  workBadge: {
    display: "inline-block",
    padding: "5px 10px",
    color: "#ffffff",
    background: "#6731ad",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
  },
  recordTitle: {
    margin: "13px 0 5px",
    fontSize: 27,
  },
  recordCreator: {
    margin: "0 0 12px",
    color: "#173e9a",
    fontSize: 18,
    fontWeight: 900,
  },
  recordDetail: {
    margin: "6px 0",
    fontWeight: 700,
  },
  fingerprintBox: {
    marginTop: 16,
    padding: 12,
    background: "#eef2f7",
    border: "2px solid #657080",
    borderRadius: 10,
  },
  fingerprint: {
    display: "block",
    marginTop: 7,
    overflowWrap: "anywhere",
    color: "#173e9a",
    fontSize: 12,
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  downloadButton: {
    flex: 1,
    minWidth: 180,
    padding: 12,
    color: "#ffffff",
    background: "#173e9a",
    border: "3px solid #111111",
    borderRadius: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  deleteButton: {
    padding: "12px 18px",
    color: "#ffffff",
    background: "#b51f2e",
    border: "3px solid #111111",
    borderRadius: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  footer: {
    marginTop: 30,
    textAlign: "center",
    fontWeight: 800,
  },
}; 
