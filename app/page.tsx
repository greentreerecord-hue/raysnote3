export default function Home() {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "20px",
        background: "#111",
        color: "#fff",
        minHeight: "100vh",
      }}
    >
      <h1>🎥 Ray'snote Videos</h1>

      <h2>Video 1</h2>
      <video controls width="100%" preload="metadata">
        <source src="/videos/video1.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      <br />
      <br />

      <h2>Video 2</h2>
      <video controls width="100%" preload="metadata">
        <source src="/videos/video2.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      <br />
      <br />

      <h2>Video 3</h2>
      <video controls width="100%" preload="metadata">
        <source src="/videos/video3.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </main>
  );
} 

