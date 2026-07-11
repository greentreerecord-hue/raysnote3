export default function ArticlesPage() {
  const articles = [
    {
      title: "Welcome to Ray'snote",
      category: "News",
      author: "Raymond Robinson",
      date: "July 7, 2026",
      summary:
        "This is the first article published on Ray'snote. More stories will appear here as they are published.",
    },
  ];

  return (
    <main style={{ maxWidth: "900px", margin: "40px auto", padding: "20px" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "20px" }}>
        Latest Articles
      </h1>

      {articles.map((article, index) => (
        <article
          key={index}
          style={{
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          <h2>{article.title}</h2>

          <p>
            <strong>{article.category}</strong> • {article.author} •{" "}
            {article.date}
          </p>

          <p>{article.summary}</p>

          <button
            style={{
              background: "#0b5ed7",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Read Article
          </button>
        </article>
      ))}
    </main>
  );
} 
