import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { useDataSaverUtils } from '../../hooks/useDataSaverUtils';
import { useTheme } from '../../hooks/useTheme';

function DemoVideo() {
  const { isDark } = useTheme();
  const { shouldLoadImage, cn } = useDataSaverUtils();
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);


  useEffect(() => {
    if (!videoRef.current) return;

    const initPlayer = () => {
      if (videoRef.current && !playerRef.current) {
        playerRef.current = videojs(videoRef.current, {
          controls: false,
          muted: true,
          fluid: true,
          responsive: true,
          poster: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9aea0008a7865980/view?project=69735edc00127d2033d8&mode=admin',
          textTrackSettings: false, // Prevent settings UI from leaking into DOM
          controlBar: false, // Disable control bar since we have custom controls
          loop: true,
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
        h-auto mt-0
        md:mb-10 mb-20
        p-2
        bg-linear-to-b from-[#d9ff00] ${isDark ? 'to-neutral-950' : 'to-neutral-400'}
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
              poster="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9aea0008a7865980/view?project=69735edc00127d2033d8&mode=admin"
              className="video-js vjs-default-skin w-full h-full object-cover rounded-2xl"
              aria-label="FairArena Dashboard Preview - Demo video showing the platform's features and interface"
              title="FairArena Dashboard Demo"
            >
              <source
                src="https://fairarena.blob.core.windows.net/fairarena/Dashboard%20Preview%20Video"
                type="video/mp4"
              />
              <p>Your browser doesn't support HTML5 video. Here is a <a href="https://fairarena.blob.core.windows.net/fairarena/Dashboard%20Preview%20Video">link to the video</a> instead.</p>
            </video>

            {/* Play Button Overlay when paused */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={togglePlay}
                  className={cn("bg-[#d9ff00] text-black rounded-full p-4 hover:bg-[#c4e600] transition-colors")}
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
