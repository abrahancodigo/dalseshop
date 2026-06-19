"use client";

import { useState, useRef } from "react";
import { extractYouTubeId, getYouTubeEmbedUrl, getYouTubePosterFallbacks } from "@/lib/videoUtils";
import styles from "./sections.module.css";

export default function VideoPlayer({ url, title }) {
  const [playing, setPlaying] = useState(false);
  const [posterIndex, setPosterIndex] = useState(0);
  const iframeRef = useRef(null);

  const videoId = extractYouTubeId(url);
  const posters = getYouTubePosterFallbacks(videoId);
  const poster = posters[posterIndex] || posters[0];
  const embedUrl = getYouTubeEmbedUrl(videoId, { autoplay: 1 });

  if (!videoId) {
    return (
      <div className={styles.videoPlayer}>
        <div className={styles.videoPlayerPlaceholder}>URL de video no válida</div>
      </div>
    );
  }

  const handlePlay = () => {
    setPlaying(true);
  };

  const handlePosterError = () => {
    if (posterIndex < posters.length - 1) {
      setPosterIndex((prev) => prev + 1);
    }
  };

  if (playing) {
    return (
      <div className={styles.videoPlayer}>
        <iframe
          ref={iframeRef}
          className={styles.videoPlayerIframe}
          src={embedUrl}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title || "Video"}
        />
      </div>
    );
  }

  return (
    <div className={styles.videoPlayer}>
      <img
        className={styles.videoPlayerPoster}
        src={poster}
        alt={title || "Video thumbnail"}
        onError={handlePosterError}
      />
      <div className={styles.videoPlayerOverlay} />
      <button className={styles.videoPlayerPlayBtn} onClick={handlePlay} aria-label="Reproducir video">
        <svg viewBox="0 0 24 24" fill="currentColor" width="80" height="80">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      {title && <div className={styles.videoPlayerTitle}>{title}</div>}
    </div>
  );
}
