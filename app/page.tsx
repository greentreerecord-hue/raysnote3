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
    description: "Featured music video on Ray'snotes.",
    src: "/videos/its%20cool.mp4",
  },
  {
    id: 2,
    title: "Video 2",
    description: "Watch Video 2 on Ray'snotes.",
    src: "/videos/video2.mp4",
  },
  {
    id: 3,
    title: "Video 3",
    description: "Watch Video 3 on Ray'snotes.",
    src: "/videos/video3.mp4",
  },
];

const startingViews: NumberRecord = {
  1: 0,
  2: 0,
  3: 0,
};

const startingLikes: NumberRecord = {
  1: 0,
  2: 0,
  3: 0,
};

const startingLikedVideos: BooleanRecord = {
  1: false,
  2: false,
  3: false,
};

export default function HomePage() {
  const [views, setViews] = useState<NumberRecord>(startingViews);
  const [likes, setLikes] = useState<NumberRecord>(startingLikes);
  const [likedVideos, setLikedVideos] =
    useState<BooleanRecord>(startingLikedVideos);

  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const savedViews = localStorage.getItem("raysnotes-views");
      const savedLikes = localStorage.getItem("raysnotes-likes");
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
      console.error("Could not load saved Ray'snotes data:", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem("raysnotes-views", JSON.stringify(views));
  }, [views, loaded]);

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem("raysnotes-likes", JSON.stringify(likes));
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
      setSubscriberCount((count) => Math.max(0, count - 1));
      showMessage("You have unsubscribed.");
    } else {
      setSubscribed(true);
      setSubscriberCount((count) => count + 1);
      showMessage("Thank you for subscribing!");
    }
  }

  function getVideoUrl(videoId: number) {
    if (typeof window === "undefined") return "";

    return `${window.location.origin}/#video-${videoId}`;
  }

  async function copyVideoLink(videoId: number) {
    try {
      await navigator.clipboard.writeText(getVideoUrl(videoId));
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
          text: `Watch ${video.title} on Ray'snotes`,
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
    const shareUrl = encodeURIComponent(getVideoUrl(videoId));

    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function shareToX(video: VideoItem) {
    const shareUrl = encodeURIComponent(getVideoUrl(video.id));
    const text = encodeURIComponent(
      `Watch ${video.title} on Ray'snotes`
    );

    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#080808",
        color: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "18px 20px",
          backgroundColor: "rgba(15, 15, 15, 0.96)",
          borderBottom: "1px solid #333333",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1150px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: "#ff3b30",
                fontSize: "34px",
              }}
            >
              Ray&apos;snotes
            </h1>

            <p
              style={{
                margin: "5px 0 0",
                color: "#bbbbbb",
              }}
            >
              Music, videos, stories and original content
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleSubscribe}
              style={{
                border: "none",
                borderRadius: "9px",
                padding: "12px 18px",
                backgroundColor: subscribed ? "#444444" : "#ff3b30",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {subscribed ? "Subscribed" : "Subscribe"} ·{" "}
              {subscriberCount}
            </button>

            <a
              href={STRIPE_PAYMENT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                borderRadius: "9px",
                padding: "12px 18px",
                backgroundColor: "#635bff",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              Paid Subscription
            </a>
          </div>
        </div>
      </header>

      {message && (
        <div
          style={{
            position: "fixed",
            top: "95px",
            left: "50%",
            zIndex: 100,
            transform: "translateX(-50%)",
            padding: "12px 18px",
            borderRadius: "8px",
            backgroundColor: "#ffffff",
            color: "#111111",
            fontWeight: "bold",
            boxShadow: "0 8px 25px rgba(0,0,0,0.45)",
          }}
        >
          {message}
        </div>
      )}

      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "55px 20px 25px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(34px, 7vw, 56px)",
          }}
        >
          Welcome to Ray&apos;snotes
        </h2>

        <p
          style={{
            maxWidth: "720px",
            margin: "18px auto 0",
            color: "#cccccc",
            fontSize: "19px",
            lineHeight: 1.6,
          }}
        >
          Watch original music, videos, stories and entertainment from
          Ray&apos;snotes.
        </p>
      </section>

      <section
        style={{
          maxWidth: "1150px",
          margin: "0 auto",
          padding: "25px 20px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "26px",
        }}
      >
        {videos.map((video) => (
          <article
            id={`video-${video.id}`}
            key={video.id}
            style={{
              overflow: "hidden",
              border: "1px solid #303030",
              borderRadius: "15px",
              backgroundColor: "#181818",
              boxShadow: "0 12px 35px rgba(0,0,0,0.4)",
            }}
          >
            <video
              controls
              loop
              playsInline
              preload="metadata"
              onPlay={() => handleVideoPlay(video.id)}
              style={{
                display: "block",
                width: "100%",
                aspectRatio: "16 / 9",
                backgroundColor: "#000000",
              }}
            >
              <source src={video.src} type="video/mp4" />
              Your browser does not support this video.
            </video>

            <div style={{ padding: "18px" }}>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: "24px",
                }}
              >
                {video.title}
              </h3>

              <p
                style={{
                  margin: "0 0 15px",
                  minHeight: "44px",
                  color: "#bbbbbb",
                  lineHeight: 1.5,
                }}
              >
                {video.description}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "15px",
                  color: "#dddddd",
                  fontWeight: "bold",
                }}
              >
                <span>{views[video.id] ?? 0} views</span>
                <span>{likes[video.id] ?? 0} likes</span>
              </div>

              <button
                type="button"
                onClick={() => handleLike(video.id)}
                style={{
                  width: "100%",
                  marginBottom: "10px",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px",
                  backgroundColor: likedVideos[video.id]
                    ? "#ff3b30"
                    : "#333333",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {likedVideos[video.id] ? "♥ Liked" : "♡ Like"}
              </button>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "9px",
                }}
              >
                <button
                  type="button"
                  onClick={() => nativeShare(video)}
                  style={shareButtonStyle}
                >
                  Share
                </button>

                <button
                  type="button"
                  onClick={() => shareToFacebook(video.id)}
                  style={shareButtonStyle}
                >
                  Facebook
                </button>

                <button
                  type="button"
                  onClick={() => shareToX(video)}
                  style={shareButtonStyle}
                >
                  X
                </button>

                <button
                  type="button"
                  onClick={() => copyVideoLink(video.id)}
                  style={shareButtonStyle}
                >
                  Copy for TikTok
                </button>

                <button
                  type="button"
                  onClick={() => copyVideoLink(video.id)}
                  style={{
                    ...shareButtonStyle,
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

      <section
        style={{
          maxWidth: "800px",
          margin: "30px auto 0",
          padding: "35px 20px",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Support Ray&apos;snotes</h2>

        <p
          style={{
            color: "#cccccc",
            lineHeight: 1.6,
          }}
        >
          Become a paid subscriber and help support new music, videos
          and original content.
        </p>

        <a
          href={STRIPE_PAYMENT_LINK}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: "10px",
            borderRadius: "10px",
            padding: "15px 25px",
            backgroundColor: "#635bff",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "18px",
            fontWeight: "bold",
          }}
        >
          Subscribe with Stripe
        </a>
      </section>

      <footer
        style={{
          marginTop: "45px",
          padding: "30px 20px",
          borderTop: "1px solid #292929",
          color: "#999999",
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()} Ray&apos;snotes. All rights
        reserved.
      </footer>
    </main>
  );
}

const shareButtonStyle = {
  border: "none",
  borderRadius: "8px",
  padding: "10px",
  backgroundColor: "#303030",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
} as const; 
