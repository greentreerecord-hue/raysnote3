"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

const STORAGE_KEY =
  "raysnotes-assisted-copyright-application";

type ApplicationData = {
  workType: string;
  title: string;
  authorName: string;
  pseudonym: string;
  claimantName: string;
  citizenship: string;
  creationYear: string;
  workForHire: string;
  published: string;
  publicationDate: string;
  publicationCountry: string;
  previousRegistration: string;
  previousNumber: string;
  preexistingMaterial: string;
  newMaterial: string;
  email: string;
  phone: string;
  address: string;
};

const emptyApplication: ApplicationData = {
  workType: "Music and lyrics",
  title: "",
  authorName: "",
  pseudonym: "",
  claimantName: "",
  citizenship: "",
  creationYear: "",
  workForHire: "No",
  published: "No",
  publicationDate: "",
  publicationCountry: "",
  previousRegistration: "No",
  previousNumber: "",
  preexistingMaterial: "",
  newMaterial: "",
  email: "",
  phone: "",
  address: "",
};

export default function AssistedCopyrightApplicationPage() {
  const [form, setForm] =
    useState<ApplicationData>(emptyApplication);

  const [certified, setCertified] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        setForm({
          ...emptyApplication,
          ...JSON.parse(saved),
        });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  function update(
    field: keyof ApplicationData,
    value: string
  ) {
    const next = {
      ...form,
      [field]: value,
    };

    setForm(next);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    );

    setMessage(
      "Draft saved privately in this browser."
    );
  }

  function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!certified) {
      setMessage(
        "Please confirm that the information is accurate."
      );
      return;
    }

    const summary = `RAY'SNOTES ASSISTED COPYRIGHT APPLICATION SUMMARY
=================================================

This is an application-preparation summary. It is not a copyright
registration and has not been submitted to the U.S. Copyright Office.

WORK INFORMATION
Work type: ${form.workType}
Title: ${form.title}
Year completed: ${form.creationYear}
Published: ${form.published}
First publication date: ${
      form.publicationDate || "Not applicable"
    }
First publication country: ${
      form.publicationCountry || "Not applicable"
    }

AUTHOR AND CLAIMANT
Author's legal name: ${form.authorName}
Pseudonym or stage name: ${
      form.pseudonym || "None"
    }
Copyright claimant: ${form.claimantName}
Citizenship or domicile: ${form.citizenship}
Work made for hire: ${form.workForHire}

PREVIOUS WORK AND NEW MATERIAL
Previously registered: ${form.previousRegistration}
Previous registration number: ${
      form.previousNumber || "None"
    }
Preexisting material excluded from this claim: ${
      form.preexistingMaterial || "None stated"
    }
New material included in this claim: ${
      form.newMaterial || "Not stated"
    }

CONTACT INFORMATION
Email: ${form.email}
Phone: ${form.phone || "Not provided"}
Mailing address: ${form.address}

NEXT STEPS
1. Review every answer carefully.
2. Choose the correct Copyright Office application type.
3. Sign in to the official eCO registration system.
4. Enter the information and upload the required deposit copy.
5. Pay the separate government filing fee.
6. Certify and submit the official application.

Official portal:
https://www.copyright.gov/registration/

Ray'sNotes does not guarantee registration and does not provide legal advice.
`;

    const blob = new Blob([summary], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      "raysnotes-copyright-application-summary.txt";

    link.click();
    URL.revokeObjectURL(url);

    setMessage("Application summary downloaded.");
  }

  function clearDraft() {
    const confirmed = window.confirm(
      "Clear this application draft from this browser?"
    );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    setForm(emptyApplication);
    setCertified(false);
    setMessage("Draft cleared.");
  }

  return (
    <main className="page">
      <div className="container">
        <Link className="back" href="/copyright">
          ← Copyright Center
        </Link>

        <header className="hero">
          <p className="eyebrow">
            GUIDED APPLICATION PREPARATION
          </p>

          <h1>Assisted Copyright Application</h1>

          <p>
            Answer each question to prepare a
            downloadable filing summary.
          </p>
        </header>

        <section className="notice">
          <h2>Before you begin</h2>

          <p>
            This service prepares information only. It
            does not file an application, provide legal
            advice, guarantee registration, or include the
            U.S. Copyright Office filing fee.
          </p>
        </section>

        <form onSubmit={submit}>
          <section className="card">
            <h2>1. Work information</h2>

            <div className="grid">
              <label>
                Type of work
                <select
                  value={form.workType}
                  onChange={(event) =>
                    update(
                      "workType",
                      event.target.value
                    )
                  }
                >
                  <option>Music and lyrics</option>
                  <option>Sound recording</option>
                  <option>
                    Writing or literary work
                  </option>
                  <option>Photograph</option>
                  <option>Visual artwork</option>
                  <option>
                    Video or motion picture
                  </option>
                  <option>
                    Software or computer program
                  </option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Title of the work
                <input
                  value={form.title}
                  onChange={(event) =>
                    update("title", event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Year the work was completed
                <input
                  type="number"
                  min="1900"
                  max="2100"
                  value={form.creationYear}
                  onChange={(event) =>
                    update(
                      "creationYear",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Has the work been published?
                <select
                  value={form.published}
                  onChange={(event) =>
                    update(
                      "published",
                      event.target.value
                    )
                  }
                >
                  <option>No</option>
                  <option>Yes</option>
                  <option>Not sure</option>
                </select>
              </label>

              {form.published === "Yes" && (
                <>
                  <label>
                    Date first published
                    <input
                      type="date"
                      value={form.publicationDate}
                      onChange={(event) =>
                        update(
                          "publicationDate",
                          event.target.value
                        )
                      }
                      required
                    />
                  </label>

                  <label>
                    Country first published
                    <input
                      value={form.publicationCountry}
                      onChange={(event) =>
                        update(
                          "publicationCountry",
                          event.target.value
                        )
                      }
                      required
                    />
                  </label>
                </>
              )}
            </div>
          </section>

          <section className="card">
            <h2>2. Author and claimant</h2>

            <div className="grid">
              <label>
                Author&apos;s full legal name
                <input
                  value={form.authorName}
                  onChange={(event) =>
                    update(
                      "authorName",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Pseudonym or stage name (optional)
                <input
                  value={form.pseudonym}
                  onChange={(event) =>
                    update(
                      "pseudonym",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Copyright claimant&apos;s legal name
                <input
                  value={form.claimantName}
                  onChange={(event) =>
                    update(
                      "claimantName",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Author&apos;s citizenship or domicile
                <input
                  value={form.citizenship}
                  onChange={(event) =>
                    update(
                      "citizenship",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Was this created as a work made for hire?
                <select
                  value={form.workForHire}
                  onChange={(event) =>
                    update(
                      "workForHire",
                      event.target.value
                    )
                  }
                >
                  <option>No</option>
                  <option>Yes</option>
                  <option>Not sure</option>
                </select>
              </label>
            </div>
          </section>

          <section className="card">
            <h2>3. Previous and new material</h2>

            <div className="grid">
              <label>
                Was this work previously registered?
                <select
                  value={form.previousRegistration}
                  onChange={(event) =>
                    update(
                      "previousRegistration",
                      event.target.value
                    )
                  }
                >
                  <option>No</option>
                  <option>Yes</option>
                  <option>Not sure</option>
                </select>
              </label>

              {form.previousRegistration === "Yes" && (
                <label>
                  Previous registration number
                  <input
                    value={form.previousNumber}
                    onChange={(event) =>
                      update(
                        "previousNumber",
                        event.target.value
                      )
                    }
                    required
                  />
                </label>
              )}
            </div>

            <label>
              Describe any preexisting material not owned
              by the claimant
              <textarea
                rows={4}
                value={form.preexistingMaterial}
                onChange={(event) =>
                  update(
                    "preexistingMaterial",
                    event.target.value
                  )
                }
                placeholder="For example: licensed beat, stock photograph, public-domain text, or previously published material."
              />
            </label>

            <label>
              Describe the new material being claimed
              <textarea
                rows={4}
                value={form.newMaterial}
                onChange={(event) =>
                  update(
                    "newMaterial",
                    event.target.value
                  )
                }
                placeholder="For example: lyrics, music, vocals, editing, illustrations, text, or computer code."
              />
            </label>
          </section>

          <section className="card">
            <h2>4. Contact information</h2>

            <div className="grid">
              <label>
                Email address
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    update("email", event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Phone number (optional)
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    update("phone", event.target.value)
                  }
                />
              </label>
            </div>

            <label>
              Mailing address
              <textarea
                rows={3}
                value={form.address}
                onChange={(event) =>
                  update("address", event.target.value)
                }
                required
              />
            </label>
          </section>

          <section className="card finalCard">
            <label className="check">
              <input
                type="checkbox"
                checked={certified}
                onChange={(event) =>
                  setCertified(event.target.checked)
                }
              />

              <span>
                I confirm that the information I entered
                is accurate to the best of my knowledge.
              </span>
            </label>

            <div className="actions">
              <button type="submit">
                Download Application Summary
              </button>

              <button
                type="button"
                className="clear"
                onClick={clearDraft}
              >
                Clear Draft
              </button>
            </div>

            {message && (
              <p className="message">{message}</p>
            )}
          </section>
        </form>

        <section className="official">
          <h2>Ready to file?</h2>

          <p>
            Review your downloaded summary, then use the
            official registration portal.
          </p>

          <a
            href="https://www.copyright.gov/registration/"
            target="_blank"
            rel="noreferrer"
          >
            Open the U.S. Copyright Office portal ↗
          </a>
        </section>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 28px;
          color: white;
          font-family: Arial, sans-serif;
          background: linear-gradient(
            145deg,
            #050816,
            #172a68
          );
        }

        .container {
          max-width: 1050px;
          margin: auto;
        }

        .back,
        .official a {
          display: inline-block;
          padding: 13px 18px;
          color: white;
          font-weight: 900;
          text-decoration: none;
          border-radius: 11px;
        }

        .back {
          margin-bottom: 22px;
          border: 2px solid white;
        }

        .hero {
          padding: 32px;
          background: linear-gradient(
            120deg,
            #10346c,
            #391760
          );
          border: 3px solid #22df7d;
          border-radius: 22px;
        }

        .eyebrow {
          color: #35f394;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .hero h1 {
          margin: 8px 0;
          font-size: clamp(36px, 6vw, 68px);
        }

        .notice,
        .card,
        .official {
          margin-top: 22px;
          padding: 26px;
          border-radius: 20px;
        }

        .notice {
          color: #332000;
          background: #fff4d6;
          border: 3px solid #ffae24;
        }

        .card {
          color: #111111;
          background: white;
          border: 3px solid #25cfd0;
        }

        .card h2,
        .notice h2,
        .official h2 {
          margin-top: 0;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(260px, 1fr)
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

        .check {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
        }

        .check input {
          width: 22px;
          height: 22px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
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

        .clear {
          background: #b42318;
        }

        .message {
          padding: 13px;
          color: #064b89;
          font-weight: 800;
          background: #e6f4ff;
          border-radius: 10px;
        }

        .official {
          color: #07111f;
          text-align: center;
          background: #ecfeff;
          border: 3px solid #20d978;
        }

        .official a {
          background: #1769e0;
        }

        @media (max-width: 600px) {
          .page {
            padding: 15px;
          }

          .hero,
          .notice,
          .card,
          .official {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
} 
