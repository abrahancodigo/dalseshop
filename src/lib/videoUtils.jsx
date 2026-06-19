/**
 * Extract YouTube video ID from any URL format.
 * Supports: watch?v=, youtu.be/, embed/, v/, shorts/, m.youtube.com
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Get YouTube automatic thumbnail URL.
 * Qualities: maxresdefault (1080p), sddefault (640px), hqdefault (480px), mqdefault (320px)
 */
export function getYouTubeThumbnail(videoId, quality = "hqdefault") {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Build YouTube embed URL with clean parameters.
 */
export function getYouTubeEmbedUrl(videoId, options = {}) {
  if (!videoId) return "";
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    controls: options.controls ?? "1",
    autoplay: options.autoplay ? "1" : "0",
    mute: options.autoplay ? "1" : "0",
    ...(options.loop && { loop: "1", playlist: videoId }),
    ...(options.start && { start: String(options.start) }),
    ...(options.end && { end: String(options.end) }),
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Check if a URL is from YouTube.
 */
export function isYouTubeUrl(url) {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be|m\.youtube\.com)/.test(url);
}

/**
 * Get poster URL with fallback chain: maxresdefault → sddefault → hqdefault → mqdefault
 */
export function getYouTubePoster(videoId) {
  if (!videoId) return null;
  return getYouTubeThumbnail(videoId, "maxresdefault");
}

/**
 * Get poster fallback URLs in order of quality.
 */
export function getYouTubePosterFallbacks(videoId) {
  if (!videoId) return [];
  return [
    getYouTubeThumbnail(videoId, "maxresdefault"),
    getYouTubeThumbnail(videoId, "sddefault"),
    getYouTubeThumbnail(videoId, "hqdefault"),
  ];
}
