export default function Page() {
  const articles = [
    "Breaking News",
    "Business & Finance",
    "Technology",
    "Entertainment",
    "Opinion",
    "Creator Spotlight",
    "World News",
    "Sports",
  ];

  const trending = [
    "Ray'snote launches online",
    "AI tools changing publishing",
    "Small business spotlight",
    "Creators build new media brands",
    "Entertainment industry updates",
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "white", fontFamily: "Arial, sans-serif", padding: "30px" }}>
      <nav style={{ display: "flex", gap: "18px", alignItems: "center", fontWeight: "bold", marginBottom: "35px" }}>
        <span style={{ color: "#facc15", fontSize: "24px" }}>Ray'snote</span>
        <span>Home</span>
        <span>News</span>
        <span>Business</span>
        <span>Tech</span>
        <span>Entertainment</span>
        <span>Opinion</span>
        <input placeholder="Search Ray'snote..." style={{ marginLeft: "auto", padding: "10px", borderRadius: "10px", border: "0" }} />
      </nav>

      <section style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", padding: "40px", borderRadius: "24px" }}>
        <p style={{ color: "#facc15", fontWeight: "bold" }}>INDEPENDENT PUBLISHING</p>
        <h1 style={{ fontSize: "64px", color: "#facc15", margin: 0 }}>Ray'snote</h1>
        <p style={{ fontSize: "24px", maxWidth: "850px" }}>
          News, stories, business, entertainment, technology, culture, creator voices, and original features.
        </p>
        <button style={goldButton}>Subscribe Now</button>
      </section>

      <section style={featuredBox}>
        <p style={{ color: "#facc15", fontWeight: "bold" }}>FEATURED STORY</p>
        <h2 style={{ fontSize: "34px" }}>Ray'snote Is Building a New Home for Independent Media</h2>
        <p style={{ color: "#cbd5e1", fontSize: "18px" }}>
          A digital publishing platform made for original articles, culture, creators, business stories, interviews, and community voices.
        </p>
        <button>Read Featured Story</button>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "24px", marginTop: "40px" }}>
        <section>
          <h2>Latest Articles</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "20px" }}>
            {articles.map((title) => (
              <article key={title} style={card}>
                <p style={{ color: "#facc15", fontWeight: "bold" }}>{title}</p>
                <h3>{title} Report</h3>
                <p style={{ color: "#94a3b8" }}>By Ray'snote Staff · 3 min read</p>
                <p style={{ color: "#cbd5e1" }}>
                  Original reporting, interviews, opinions, and feature stories from Ray'snote.
                </p>
                <button>Read More</button>
              </article>
            ))}
          </div>
        </section>

        <aside style={sidebar}>
          <h2>Trending</h2>
          {trending.map((item, index) => (
            <p key={item} style={{ borderBottom: "1px solid #334155", paddingBottom: "12px" }}>
              #{index + 1} 🔥 {item}
            </p>
          ))}
        </aside>
      </div>

      <section style={newsletter}>
        <h2>Join the Ray'snote Newsletter</h2>
        <p>Get headlines, stories, and exclusive updates sent to your inbox.</p>
        <input placeholder="Enter your email" style={{ padding: "14px", borderRadius: "10px", border: "0", minWidth: "260px" }} />
        <button style={{ marginLeft: "10px" }}>Join</button>
      </section>

      <footer style={{ marginTop: "45px", color: "#94a3b8", borderTop: "1px solid #334155", paddingTop: "20px" }}>
        © 2026 Ray'snote · About · Contact · Privacy · Terms
      </footer>
    </main>
  );
}

const goldButton = {
  background: "#facc15",
  color: "black",
  border: "none",
  padding: "14px 28px",
  borderRadius: "12px",
  fontSize: "18px",
  fontWeight: "bold",
};

const featuredBox = {
  marginTop: "35px",
  background: "#1e293b",
  padding: "30px",
  borderRadius: "20px",
};

const card = {
  background: "#1e293b",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #334155",
};

const sidebar = {
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
};

const newsletter = {
  marginTop: "45px",
  background: "#facc15",
  color: "black",
  padding: "30px",
  borderRadius: "20px",
}; 
