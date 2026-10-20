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

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "14px",
};

const priceStyle: CSSProperties = {
  color: "#67e8f9",
  fontWeight: 700,
  fontSize: "24px",
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

          <p style={{ ...paragraphStyle, fontSize: "20px" }}>
            Find Hawaii LLC, trademark, and patent preparation
            tools, plus copyright and bankruptcy resources.
          </p>

          <p style={paragraphStyle}>
            Each service explains its scope, charges, and submission
            steps. Saving a draft or purchasing a preparation package
            does not submit a government filing. Ray&apos;sNotes
            does not provide legal or tax advice.
          </p>

          <a
            href="/my-applications"
            style={{ ...buttonStyle, background: "#0e7490" }}
          >
            Open My Applications
          </a>
        </header>

        <section
          aria-label="Preparation services and filing resources"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "24px",
          }}
        >
          <article style={cardStyle}>
            <h2>Hawaii LLC Preparation Package</h2>

            <p style={priceStyle}>$24.99 per LLC</p>

            <p style={paragraphStyle}>
              Organize your business information, save unfinished
              answers in your account, and unlock a downloadable
              preparation summary and filing checklist with payment.
            </p>

            <p style={paragraphStyle}>
              Your $24.99 preparation payment provides a one-time
              credit toward the $149 full-service fee for the same
              LLC. The remaining service charge is $124.01.
              Government fees are separate.
            </p>

            <p style={{ ...paragraphStyle, color: "#fde68a" }}>
              Full-service upgrade checkout is coming soon.
              Preparation does not form an LLC, reserve a name,
              or submit Articles of Organization.
            </p>

            <div style={actionsStyle}>
              <a
                href="/filing-center/hawaii-llc"
                style={{ ...buttonStyle, background: "#0e7490" }}
              >
                Open LLC Preparation
              </a>

              <a href="/my-applications" style={buttonStyle}>
                My Saved Applications
              </a>

              <a
                href="https://cca.hawaii.gov/breg/registration/dllc/"
                target="_blank"
                rel="noopener noreferrer"
                style={buttonStyle}
              >
                Hawaii LLC Official Resources ↗
              </a>
            </div>
          </article>

          <article style={cardStyle}>
            <h2>Trademark Preparation Package</h2>

            <p style={priceStyle}>
              $24.99 per qualifying package
            </p>

            <p style={paragraphStyle}>
              Organize your proposed brand name or logo, owner
              information, products or services, and supporting
              materials.
            </p>

            <p style={paragraphStyle}>
              Start a draft and save it in this browser.
              Trademark drafts are currently separate from
              My Applications.
            </p>

            <p style={{ ...paragraphStyle, color: "#fde68a" }}>
              Checkout and paid PDF downloads are coming soon.
              No payment is collected on the preparation page.
              Package scope and eligibility details will be
              explained before purchase.
            </p>

            <p style={paragraphStyle}>
              Preparation only. Trademark searches, legal opinions,
              government filing fees, and legal representation
              are not included. Purchasing a package does not
              register a trademark or guarantee approval.
            </p>

            <div style={actionsStyle}>
              <a
                href="/filing-center/trademark"
                style={{ ...buttonStyle, background: "#0e7490" }}
              >
                Open Trademark Preparation
              </a>
            </div>
          </article>

          <article style={cardStyle}>
            <h2>Patent Preparation Organizer</h2>

            <p style={priceStyle}>
              $24.99 per qualifying package
            </p>

            <p style={paragraphStyle}>
              Organize your invention description, inventor
              information, development notes, supporting materials,
              and questions for a patent professional.
            </p>

            <p style={paragraphStyle}>
              Start a draft and save it in this browser.
              Patent drafts are currently separate from
              My Applications.
            </p>

            <p style={{ ...paragraphStyle, color: "#fde68a" }}>
              Checkout and paid PDF downloads are coming soon.
              No payment is collected on the organizer page.
              Package scope and eligibility details will be
              explained before purchase.
            </p>

            <p style={paragraphStyle}>
              Preparation only. Patent searches, patentability
              opinions, patent application or claim drafting,
              government filing fees, and legal representation
              are not included. Purchasing an organizer does not
              file a patent application or create patent protection.
            </p>

            <div style={actionsStyle}>
              <a
                href="/filing-center/patent"
                style={{ ...buttonStyle, background: "#0e7490" }}
              >
                Open Patent Organizer
              </a>
            </div>
          </article>

          <article style={cardStyle}>
            <h2>Bankruptcy Resources</h2>

            <p style={paragraphStyle}>
              Visit the official U.S. Courts website for bankruptcy
              information and resources for people filing without
              an attorney. Check your local court&apos;s filing
              instructions and online options.
            </p>

            <div style={actionsStyle}>
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
              Prepare copyright application summaries, return to
              saved drafts, or explore the separate full-service
              filing option.
            </p>

            <div style={actionsStyle}>
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
          External links open in a new tab. Government filing
          requirements and fees are set by the relevant court
          or agency.
        </footer>
      </div>
    </main>
  );
} 
