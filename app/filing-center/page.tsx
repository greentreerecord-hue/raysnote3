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

const paragraphStyle: CSSProperties = {
  color: "#cccccc",
  lineHeight: 1.7,
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

          <p
            style={{
              ...paragraphStyle,
              fontSize: "20px",
            }}
          >
            Find bankruptcy, copyright, and business filing
            resources in one place.
          </p>

          <p style={paragraphStyle}>
            Explore official resources and Ray&apos;sNotes
            preparation services. Opening a link or saving a
            draft does not submit a filing. Each service explains
            its scope, charges, and submission steps.
            Ray&apos;sNotes does not provide legal advice.
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

            <p style={paragraphStyle}>
              Visit the official U.S. Courts website for bankruptcy
              information and resources for people filing without
              an attorney. Check your local court&apos;s filing
              instructions and online options.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <a
                href="https://www.uscourts.gov/court-programs/bankruptcy"
                target="_blank"
                rel="noopener noreferrer"
                style={buttonStyle}
              >
                U.S. Courts Bankruptcy ↗
              </a>

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

            <p style={paragraphStyle}>
              Open the Ray&apos;sNotes Copyright Center or visit
              the U.S. Copyright Office for official registration
              information.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <a
                href="/copyright"
                style={{
                  ...buttonStyle,
                  background: "#15803d",
                }}
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
            <h2>Hawaii LLC Registration</h2>

            <p
              style={{
                color: "#67e8f9",
                fontWeight: 700,
              }}
            >
              Coming soon
            </p>

            <p style={paragraphStyle}>
              Prepare your Hawaii LLC information, save your
              progress, and request filing assistance through
              Ray&apos;sNotes. Service pricing and state fees
              will be displayed before payment when the service
              launches.
            </p>

            <p style={paragraphStyle}>
              Preparing a draft does not form an LLC.
              Registration requires acceptance by Hawaii&apos;s
              Business Registration Division.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <a
                href="https://cca.hawaii.gov/breg/registration/dllc/"
                target="_blank"
                rel="noopener noreferrer"
                style={buttonStyle}
              >
                Hawaii LLC Official Resources ↗
              </a>

              <a
                href="https://www.sba.gov/"
                target="_blank"
                rel="noopener noreferrer"
                style={buttonStyle}
              >
                Visit SBA.gov ↗
              </a>
            </div>
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
          and government fees are set by the relevant court or
          agency.
        </footer>
      </div>
    </main>
  );
} 
