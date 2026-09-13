"use client";

import { useEffect, useState } from "react";

type VideoItem = {
  id: number;
  title: string;
  description: string;
  src: string;
};

type NumberRecord = Record<number, number>;
type BooleanRecord = Record<number, boolean>;

const STRIPE_PAYMENT_LINK =
  "https://buy.stripe.com/fZu6oH08q6VV3Zw5TP2Nq02";

const videos: VideoItem[] = [
  {
    id: 1,
    title: "It's Cool",
    description:
      "Featured music video on Ray'sNotes.",
    src: "/videos/its%20cool.mp4",
  },
  {
    id: 2,
    title: "Video 2",
    description:
      "Watch Video 2 on Ray'sNotes.",
    src: "/videos/video2.mp4",
  },
  {
    id: 3,
    title: "Video 3",
    description:
      "Watch Video 3 on Ray'sNotes.",
    src: "/videos/video3.mp4",
  },
];

export default function HomePage() {
  const [views, setViews] = useState<NumberRecord>({
    1: 0,
    2: 0,
    3: 0,
  });

  const [likes, setLikes] = useState<NumberRecord>({
    1: 0,
    2: 0,
    3: 0,
  });

  const [likedVideos, setLikedVideos] =
    useState<BooleanRecord>({
      1: false,
      2: false,
      3: false,
    });

  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] =
    useState(0);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const savedViews = localStorage.getItem(
        "raysnotes-views"
      );

      const savedLikes = localStorage.getItem(
        "raysnotes-likes"
      );

      const savedLikedVideos = localStorage.getItem(
        "raysnotes-liked-videos"
      );

      const savedSubscribed = localStorage.getItem(
        "raysnotes-subscribed"
      );

      const savedSubscriberCount = localStorage.getItem(
        "raysnotes-subscriber-count"
      );

      if (savedViews) {
        setViews(JSON.parse(savedViews));
      }

      if (savedLikes) {
        setLikes(JSON.parse(savedLikes));
      }

      if (savedLikedVideos) {
        setLikedVideos(JSON.parse(savedLikedVideos));
      }

      if (savedSubscribed) {
        setSubscribed(savedSubscribed === "true");
      }

      if (savedSubscriberCount) {
        setSubscriberCount(Number(savedSubscriberCount));
      }
    } catch (error) {
      console.error(
        "Could not load saved Ray'sNotes data:",
        error
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      "raysnotes-views",
      JSON.stringify(views)
    );
  }, [views, loaded]);

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      "raysnotes-likes",
      JSON.stringify(likes)
    );

    localStorage.setItem(
      "raysnotes-liked-videos",
      JSON.stringify(likedVideos)
    );
  }, [likes, likedVideos, loaded]);

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      "raysnotes-subscribed",
      String(subscribed)
    );

    localStorage.setItem(
      "raysnotes-subscriber-count",
      String(subscriberCount)
    );
  }, [subscribed, subscriberCount, loaded]);

  function showMessage(text: string) {
    setMessage(text);

    window.setTimeout(() => {
      setMessage("");
    }, 2500);
  }

  function handleVideoPlay(videoId: number) {
    setViews((currentViews) => ({
      ...currentViews,
      [videoId]: (currentViews[videoId] ?? 0) + 1,
    }));
  }

  function handleLike(videoId: number) {
    const alreadyLiked = likedVideos[videoId];

    setLikedVideos((current) => ({
      ...current,
      [videoId]: !alreadyLiked,
    }));

    setLikes((currentLikes) => ({
      ...currentLikes,
      [videoId]: alreadyLiked
        ? Math.max(0, (currentLikes[videoId] ?? 0) - 1)
        : (currentLikes[videoId] ?? 0) + 1,
    }));
  }

  function handleSubscribe() {
    if (subscribed) {
      setSubscribed(false);
      setSubscriberCount((count) =>
        Math.max(0, count - 1)
      );
      showMessage("You have unsubscribed.");
    } else {
      setSubscribed(true);
      setSubscriberCount((count) => count + 1);
      showMessage("Thank you for subscribing!");
    }
  }

  function getVideoUrl(videoId: number) {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/#video-${videoId}`;
  }

  async function copyVideoLink(videoId: number) {
    try {
      await navigator.clipboard.writeText(
        getVideoUrl(videoId)
      );

      showMessage("Video link copied.");
    } catch {
      showMessage("Unable to copy the link.");
    }
  }

  async function nativeShare(video: VideoItem) {
    const shareUrl = getVideoUrl(video.id);

    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: `Watch ${video.title} on Ray'sNotes`,
          url: shareUrl,
        });
      } else {
        await copyVideoLink(video.id);
      }
    } catch {
      console.log("Sharing was cancelled.");
    }
  }

  function shareToFacebook(videoId: number) {
    const shareUrl = encodeURIComponent(
      getVideoUrl(videoId)
    );

    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function shareToX(video: VideoItem) {
    const shareUrl = encodeURIComponent(
      getVideoUrl(video.id)
    );

    const text = encodeURIComponent(
      `Watch ${video.title} on Ray'sNotes`
    );

    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <h1 style={styles.logo}>
              Ray&apos;sNotes
            </h1>

            <p style={styles.tagline}>
              Music, videos, stories and original content
            </p>
          </div>

          <nav style={styles.navigation}>
            <a
              href="/copyright"
              style={styles.copyrightButton}
            >
              © Copyright Center
            </a>

            <button
              type="button"
              onClick={handleSubscribe}
              style={{
                ...styles.subscribeButton,
                backgroundColor: subscribed
                  ? "#444444"
                  : "#ff3b30",
              }}
            >
              {subscribed ? "Subscribed" : "Subscribe"} ·{" "}
              {subscriberCount}
            </button>

            <a
              href={STRIPE_PAYMENT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.paymentButton}
            >
              Paid Subscription
            </a>
          </nav>
        </div>
      </header>

      {message && (
        <div style={styles.message}>{message}</div>
      )}

      <section style={styles.welcome}>
        <h2 style={styles.welcomeHeading}>
          Welcome to Ray&apos;sNotes
        </h2>

        <p style={styles.welcomeText}>
          Watch original music, videos, stories and
          entertainment from Ray&apos;sNotes.
        </p>

        <a
          href="/copyright"
          style={styles.largeCopyrightButton}
        >
          © Open Copyright Center
        </a>
      </section>

      <section style={styles.videoGrid}>
        {videos.map((video) => (
          <article
            id={`video-${video.id}`}
            key={video.id}
            style={styles.videoCard}
          >
            <video
              controls
              loop
              playsInline
              preload="metadata"
              onPlay={() => handleVideoPlay(video.id)}
              style={styles.video}
            >
              <source
                src={video.src}
                type="video/mp4"
              />

              Your browser does not support this video.
            </video>

            <div style={styles.videoBody}>
              <h3 style={styles.videoTitle}>
                {video.title}
              </h3>

              <p style={styles.videoDescription}>
                {video.description}
              </p>

              <div style={styles.videoStats}>
                <span>
                  {views[video.id] ?? 0} views
                </span>

                <span>
                  {likes[video.id] ?? 0} likes
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleLike(video.id)}
                style={{
                  ...styles.likeButton,
                  backgroundColor:
                    likedVideos[video.id]
                      ? "#ff3b30"
                      : "#333333",
                }}
              >
                {likedVideos[video.id]
                  ? "♥ Liked"
                  : "♡ Like"}
              </button>

              <div style={styles.shareGrid}>
                <button
                  type="button"
                  onClick={() => nativeShare(video)}
                  style={styles.shareButton}
                >
                  Share
                </button>

                <button
                  type="button"
                  onClick={() =>
                    shareToFacebook(video.id)
                  }
                  style={styles.shareButton}
                >
                  Facebook
                </button>

                <button
                  type="button"
                  onClick={() => shareToX(video)}
                  style={styles.shareButton}
                >
                  X
                </button>

                <button
                  type="button"
                  onClick={() =>
                    copyVideoLink(video.id)
                  }
                  style={styles.shareButton}
                >
                  Copy for TikTok
                </button>

                <button
                  type="button"
                  onClick={() =>
                    copyVideoLink(video.id)
                  }
                  style={{
                    ...styles.shareButton,
                    gridColumn: "1 / -1",
                  }}
                >
                  Copy for Instagram
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section style={styles.copyrightPanel}>
        <div style={styles.copyrightIcon}>©</div>

        <h2 style={styles.copyrightHeading}>
          Ray&apos;sNotes Copyright Center
        </h2>

        <p style={styles.copyrightText}>
          Create a private record and digital
          fingerprint for your original music, writing,
          artwork, photography, video, software, or
          other creative work.
        </p>

        <a
          href="/copyright"
          style={styles.copyrightPanelButton}
        >
          Create a Creation Record
        </a>
      </section>

      <section style={styles.supportPanel}>
        <h2>Support Ray&apos;sNotes</h2>

        <p style={styles.supportText}>
          Become a paid subscriber and help support new
          music, videos and original content.
        </p>

        <a
          href={STRIPE_PAYMENT_LINK}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.largePaymentButton}
        >
          Subscribe with Stripe
        </a>
      </section>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} Ray&apos;sNotes. All
        rights reserved.
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#080808",
    color: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    padding: "18px 20px",
    backgroundColor: "rgba(15,15,15,0.96)",
    borderBottom: "1px solid #333333",
    backdropFilter: "blur(10px)",
  },
  headerInner: {
    width: "100%",
    maxWidth: 1150,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
  },
  logo: {
    margin: 0,
    color: "#ff3b30",
    fontSize: 34,
  },
  tagline: {
    margin: "5px 0 0",
    color: "#bbbbbb",
  },
  navigation: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  copyrightButton: {
    display: "inline-block",
    padding: "11px 16px",
    backgroundColor: "#35dc7b",
    color: "#111111",
    border: "3px solid #ffffff",
    borderRadius: 9,
    textDecoration: "none",
    fontSize: 16,
    fontWeight: 900,
  },
  subscribeButton: {
    padding: "12px 18px",
    color: "#ffffff",
    border: "none",
    borderRadius: 9,
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
  },
  paymentButton: {
    display: "inline-block",
    padding: "12px 18px",
    backgroundColor: "#635bff",
    color: "#ffffff",
    borderRadius: 9,
    textDecoration: "none",
    fontSize: 16,
    fontWeight: "bold",
  },
  message: {
    position: "fixed",
    top: 95,
    left: "50%",
    zIndex: 100,
    transform: "translateX(-50%)",
    padding: "12px 18px",
    backgroundColor: "#ffffff",
    color: "#111111",
    borderRadius: 8,
    fontWeight: "bold",
    boxShadow: "0 8px 25px rgba(0,0,0,0.45)",
  },
  welcome: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "55px 20px 30px",
    textAlign: "center",
  },
  welcomeHeading: {
    margin: 0,
    fontSize: "clamp(34px, 7vw, 56px)",
  },
  welcomeText: {
    maxWidth: 720,
    margin: "18px auto",
    color: "#cccccc",
    fontSize: 19,
    lineHeight: 1.6,
  },
  largeCopyrightButton: {
    display: "inline-block",
    padding: "14px 22px",
    backgroundColor: "#35dc7b",
    color: "#111111",
    border: "3px solid #ffffff",
    borderRadius: 11,
    textDecoration: "none",
    fontSize: 18,
    fontWeight: 900,
  },
  videoGrid: {
    maxWidth: 1150,
    margin: "0 auto",
    padding: "25px 20px",
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 26,
  },
  videoCard: {
    overflow: "hidden",
    backgroundColor: "#181818",
    border: "1px solid #303030",
    borderRadius: 15,
    boxShadow: "0 12px 35px rgba(0,0,0,0.4)",
  },
  video: {
    display: "block",
    width: "100%",
    aspectRatio: "16 / 9",
    backgroundColor: "#000000",
  },
  videoBody: {
    padding: 18,
  },
  videoTitle: {
    margin: "0 0 8px",
    fontSize: 24,
  },
  videoDescription: {
    margin: "0 0 15px",
    minHeight: 44,
    color: "#bbbbbb",
    lineHeight: 1.5,
  },
  videoStats: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 15,
    color: "#dddddd",
    fontWeight: "bold",
  },
  likeButton: {
    width: "100%",
    marginBottom: 10,
    padding: 12,
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
  },
  shareGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 9,
  },
  shareButton: {
    padding: 10,
    backgroundColor: "#303030",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer",
  },
  copyrightPanel: {
    maxWidth: 900,
    margin: "35px auto",
    padding: "30px 20px",
    background:
      "linear-gradient(135deg, #172a67, #651c88)",
    border: "4px solid #35dc7b",
    borderRadius: 20,
    textAlign: "center",
  },
  copyrightIcon: {
    display: "grid",
    placeItems: "center",
    width: 80,
    height: 80,
    margin: "0 auto 15px",
    backgroundColor: "#35dc7b",
    color: "#111111",
    border: "4px solid #ffffff",
    borderRadius: "50%",
    fontSize: 54,
    fontWeight: 900,
  },
  copyrightHeading: {
    margin: "0 0 12px",
    fontSize: 32,
  },
  copyrightText: {
    maxWidth: 700,
    margin: "0 auto 18px",
    lineHeight: 1.6,
    fontSize: 17,
    fontWeight: 700,
  },
  copyrightPanelButton: {
    display: "inline-block",
    padding: "13px 20px",
    backgroundColor: "#ffffff",
    color: "#111111",
    border: "3px solid #111111",
    borderRadius: 11,
    textDecoration: "none",
    fontWeight: 900,
  },
  supportPanel: {
    maxWidth: 800,
    margin: "30px auto 0",
    padding: "35px 20px",
    textAlign: "center",
  },
  supportText: {
    color: "#cccccc",
    lineHeight: 1.6,
  },
  largePaymentButton: {
    display: "inline-block",
    marginTop: 10,
    padding: "15px 25px",
    backgroundColor: "#635bff",
    color: "#ffffff",
    borderRadius: 10,
    textDecoration: "none",
    fontSize: 18,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 45,
    padding: "30px 20px",
    borderTop: "1px solid #292929",
    color: "#999999",
    textAlign: "center",
  },
}; 
