import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { useDataSaverUtils } from '../../hooks/useDataSaverUtils';
import { useTheme } from '../../hooks/useTheme';

function DemoVideo() {
  const { theme } = useTheme();
  const { shouldLoadImage, cn } = useDataSaverUtils();
  const [isDark, setIsDark] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!videoRef.current) return;

    const initPlayer = () => {
      if (videoRef.current && !playerRef.current) {
        playerRef.current = videojs(videoRef.current, {
          controls: false,
          muted: true,
          fluid: true,
          responsive: true,
          poster: 'https://fairarena.blob.core.windows.net/fairarena/Dashboard Preview',
        });

        const player = playerRef.current;

        player.on('play', () => setIsPlaying(true));
        player.on('pause', () => setIsPlaying(false));
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(initPlayer);

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    }
  };

  return (
    <div
      className={`
        w-[90%] sm:w-[85%] md:w-[80%] lg:w-full
        max-w-7xl mx-auto
        h-auto mt-10 md:mt-15
        md:mb-20 mb-40
        p-2
        bg-linear-to-b from-[#DDFF00] ${isDark ? 'to-neutral-950' : 'to-neutral-400'}
        rounded-3xl
      `}
    >
      <div
        className={`
          w-full h-full relative overflow-hidden rounded-2xl
          ${isDark ? 'bg-neutral-900' : 'bg-white'}
        `}
      >
        {shouldLoadImage ? (
          <>
            <video
              ref={videoRef}
              poster="https://fairarena.blob.core.windows.net/fairarena/Dashboard Preview"
              className="video-js vjs-default-skin w-full h-full object-cover rounded-2xl"
            >
              <source
                src="https://fairarena.blob.core.windows.net/fairarena/Dashboard%20Preview%20Video"
                type="video/mp4"
              />
            </video>

            {/* Play Button Overlay when paused */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={togglePlay}
                  className={cn("bg-[#DDFF00] text-black rounded-full p-4 hover:bg-[#c4e600] transition-colors")}
                >
                  <Play size={48} fill="currentColor" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-64 md:h-96 flex items-center justify-center bg-linear-to-br from-primary/20 to-primary/10 rounded-2xl">
            <div className="text-center">
              <Play size={64} className="mx-auto mb-4 text-primary/60" />
              <p className="text-lg font-semibold text-muted-foreground">Demo Video</p>
              <p className="text-sm text-muted-foreground">Video loading disabled in data saver mode</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DemoVideo;
