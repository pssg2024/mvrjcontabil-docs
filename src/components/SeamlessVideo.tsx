import React, { useRef, useState, useEffect, useCallback } from 'react';

interface SeamlessVideoProps {
  src: string;
  fallbackSrc?: string;
  className?: string;
  overlayClassName?: string;
  crossFadeDuration?: number; // Duration of transition in seconds
}

/**
 * SeamlessVideo: Plays HTML5 video in an infinite, seamless crossfade loop.
 * Eliminates the native browser loop stutter / pause ("paradinha") by
 * running two alternating video streams that cross-dissolve into each other
 * before the current video reaches the end.
 */
export const SeamlessVideo: React.FC<SeamlessVideoProps> = ({
  src,
  fallbackSrc,
  className = 'w-full h-full object-cover select-none',
  overlayClassName,
  crossFadeDuration = 1.2,
}) => {
  const v1Ref = useRef<HTMLVideoElement>(null);
  const v2Ref = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1);
  const isTransitioningRef = useRef(false);

  // Helper to ensure playback without browser autoplay issues
  const safePlay = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    try {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Retry muted autoplay
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    } catch {}
  }, []);

  // Initial playback
  useEffect(() => {
    const v1 = v1Ref.current;
    if (v1) {
      v1.currentTime = 0;
      safePlay(v1);
    }
  }, [src, safePlay]);

  // Main monitoring loop using requestAnimationFrame
  useEffect(() => {
    let animId: number;

    const checkLoop = () => {
      const current = activeVideo === 1 ? v1Ref.current : v2Ref.current;
      const next = activeVideo === 1 ? v2Ref.current : v1Ref.current;

      if (current && next && current.duration && !Number.isNaN(current.duration)) {
        const timeLeft = current.duration - current.currentTime;

        // When nearing the end of current video, start the other video smoothly
        if (timeLeft <= crossFadeDuration && !isTransitioningRef.current && current.currentTime > 0.5) {
          isTransitioningRef.current = true;

          // Start the next video from the beginning
          next.currentTime = 0;
          safePlay(next);

          // Smoothly crossfade by toggling active video
          setActiveVideo(prev => (prev === 1 ? 2 : 1));

          // Reset the finished video after the crossfade completes
          setTimeout(() => {
            if (current) {
              current.pause();
              current.currentTime = 0;
            }
            isTransitioningRef.current = false;
          }, crossFadeDuration * 1000 + 100);
        }
      }

      animId = requestAnimationFrame(checkLoop);
    };

    animId = requestAnimationFrame(checkLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activeVideo, crossFadeDuration, safePlay]);

  // Resume smoothly if browser tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const current = activeVideo === 1 ? v1Ref.current : v2Ref.current;
        if (current && current.paused) {
          safePlay(current);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeVideo, safePlay]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Stream 1 */}
      <video
        ref={v1Ref}
        muted
        playsInline
        autoPlay
        preload="auto"
        className={`${className} absolute inset-0 transition-opacity duration-1000 ease-in-out ${
          activeVideo === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'
        }`}
        onEnded={() => {
          if (!isTransitioningRef.current) {
            const next = v2Ref.current;
            if (next) {
              next.currentTime = 0;
              safePlay(next);
              setActiveVideo(2);
            }
          }
        }}
      >
        <source src={src} type="video/mp4" />
        {fallbackSrc && <source src={fallbackSrc} type="video/mp4" />}
      </video>

      {/* Stream 2 (alternating buffer for seamless dissolve) */}
      <video
        ref={v2Ref}
        muted
        playsInline
        preload="auto"
        className={`${className} absolute inset-0 transition-opacity duration-1000 ease-in-out ${
          activeVideo === 2 ? 'opacity-100 z-10' : 'opacity-0 z-0'
        }`}
        onEnded={() => {
          if (!isTransitioningRef.current) {
            const next = v1Ref.current;
            if (next) {
              next.currentTime = 0;
              safePlay(next);
              setActiveVideo(1);
            }
          }
        }}
      >
        <source src={src} type="video/mp4" />
        {fallbackSrc && <source src={fallbackSrc} type="video/mp4" />}
      </video>

      {/* Overlay */}
      {overlayClassName && <div className={overlayClassName} />}
    </div>
  );
};
