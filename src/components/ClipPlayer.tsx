"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface ClipPlayerHandle {
  seekTo: (sec: number, play?: boolean) => void;
  play: () => void;
  pause: () => void;
}

interface Props {
  videoId: string;
  initialStart?: number;
  autoplay?: boolean;
}

/**
 * Embedded YouTube player that seeks via postMessage instead of remounting.
 * Mounted once per videoId — seek commands fire over the JS API.
 */
export const ClipPlayer = forwardRef<ClipPlayerHandle, Props>(function ClipPlayer(
  { videoId, initialStart = 0, autoplay = false },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  function send(func: string, args: unknown[] = []) {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }

  useImperativeHandle(ref, () => ({
    seekTo: (sec, play = true) => {
      send("seekTo", [Math.floor(sec), true]);
      if (play) send("playVideo");
    },
    play: () => send("playVideo"),
    pause: () => send("pauseVideo"),
  }), []);

  const params = new URLSearchParams({
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
  });
  if (initialStart > 0) params.set("start", String(Math.floor(initialStart)));
  if (autoplay) params.set("autoplay", "1");
  const src = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;

  // Add origin after mount (avoids SSR window access)
  useEffect(() => {
    if (!iframeRef.current) return;
    const cur = iframeRef.current.src;
    if (!cur.includes("origin=")) {
      const u = new URL(cur);
      u.searchParams.set("origin", window.location.origin);
      iframeRef.current.src = u.toString();
    }
  }, []);

  return (
    <iframe
      ref={iframeRef}
      key={videoId}
      src={src}
      className="w-full h-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
});
