import Link from "next/link";

const articles: any = {
  "breaking-news-report": {
    title: "Breaking News Report",
    readTime: "3 min read",
    body: "This is the featured breaking news story for Ray'snote.",
  },
  "business-update": {
    title: "Business Update",
    readTime: "4 min read",
    body: "This is the latest business update from Ray'snote.",
  },
  "technology-news": {
    title: "Technology News",
    readTime: "5 min read",
    body: "This is the latest technology story from Ray'snote.",
  },
};

export default function ArticlePage({ params }: any) {
  const article = articles[params.slug];

  if (!article) {
    return (
      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>
        <Link href="/">← Back to Ray'snote</Link>
        <h1>Article Not Found</h1>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>
      <Link href="/">← Back to Ray'snote</Link>

      <p style={{ color: "#c47a32", marginTop: "40px" }}>Ray'snote Article</p>

      <h1 style={{ fontSize: "56px" }}>{article.title}</h1>

      <p>By Ray'snote Staff • {article.readTime}</p>

      <p style={{ fontSize: "22px", lineHeight: "1.8", marginTop: "40px" }}>
        {article.body}
      </p>

      <p style={{ fontSize: "22px", lineHeight: "1.8" }}>
        Ray'snote is building an independent publishing platform for news,
        business, opinion, and creator stories.
      </p>
    </main>
  );
} 
