import type { CSSProperties } from "react";

const buttonStyle: CSSProperties = {
  display: "inline-block",
  padding: "14px 20px",
  background: "#2563eb",
  color: "#ffffff",
  border: "2px solid #ffffff",
  borderRadius: "12px",
  textDecoration: "none",
  fontWeight: 700,
};

const cardStyle: CSSProperties = {
  padding: "26px",
  background: "#151515",
  border: "1px solid #444",
  borderRadius: "18px",
};

export default function FilingCenterPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <a href="/" style={buttonStyle}>
          ← Back to Ray&apos;sNotes
        </a>

        <header style={{ margin: "40px 0" }}>
          <h1 style={{ fontSize: "clamp(32px, 6vw, 52px)" }}>
            Ray&apos;sNotes Filing Center
          </h1>

          <p style={{ color: "#cccccc", fontSize: "20px", lineHeight: 1.6 }}>
            Find bankruptcy, copyright, and business filing resources
            in one place.
          </p>

          <p style={{ color: "#cccccc", lineHeight: 1.7 }}>
            Ray&apos;sNotes provides resource links, not legal advice.
            Opening a link does not submit a filing. Complete the
            required steps with the relevant court or agency.
          </p>
        </header>

        <section
          aria-label="Filing resources"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "24px",
          }}
        >
          <article style={cardStyle}>
            <h2>Bankruptcy Resources</h2>

            <p style={{ color: "#cccccc", lineHeight: 1.7 }}>
              Visit the official U.S. Courts website for bankruptcy
              information and resources for people filing without
              an attorney. Check your local court&apos;s filing
              instructions and online options.
            </p>

            <a
              href="https://www.uscourts.gov/court-programs/bankruptcy"
              target="_blank"
              rel="noopener noreferrer"
              style={buttonStyle}
            >
              U.S. Courts Bankruptcy ↗
            </a><div style={{ marginTop: "16px" }}>
  <a
    href="/filing-center/bankruptcy"
    style={buttonStyle}
  >
    Open Hawaii Preparation Package
  </a>
</div> 

          </article>

          <article style={cardStyle}>
            <h2>Copyright Center</h2>

            <p style={{ color: "#cccccc", lineHeight: 1.7 }}>
              Open the Ray&apos;sNotes Copyright Center or visit
              the U.S. Copyright Office for official registration
              information.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
              <a
                href="/copyright"
                style={{ ...buttonStyle, background: "#15803d" }}
              >
                Open Copyright Center
              </a>

              <a
                href="https://www.copyright.gov/"
                target="_blank"
                rel="noopener noreferrer"
                style={buttonStyle}
              >
                U.S. Copyright Office ↗
              </a>
            </div>
          </article>

          <article style={cardStyle}>
            <h2>Business Filing Resources</h2>

            <p style={{ color: "#cccccc", lineHeight: 1.7 }}>
              Visit the U.S. Small Business Administration for
              business registration resources. Use your state&apos;s
              official agency for state filings.
            </p>

            <a
              href="https://www.sba.gov/"
              target="_blank"
              rel="noopener noreferrer"
              style={buttonStyle}
            >
              Visit SBA.gov ↗
            </a>
          </article>
        </section>

        <footer
          style={{
            marginTop: "40px",
            paddingTop: "24px",
            borderTop: "1px solid #444",
            color: "#bbbbbb",
            lineHeight: 1.7,
          }}
        >
          External links open in a new tab. Filing requirements
          and fees are set by the relevant court or agency.
        </footer>
      </div>
    </main>
  );
} 
