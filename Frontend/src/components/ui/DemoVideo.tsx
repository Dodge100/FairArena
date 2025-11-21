import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { useTheme } from '../../hooks/useTheme';

function DemoVideo() {
  const { theme } = useTheme();
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
          poster: '/dashboardDemo.jpg',
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
          w-full h-full relative  overflow-hidden rounded-2xl
          ${isDark ? 'bg-neutral-900' : 'bg-white'}
        `}
      >
        <video
          ref={videoRef}
          poster="/dashboardDemo.jpg"
          className="video-js vjs-default-skin w-full h-full object-cover rounded-2xl"
        >
          <source
            src="https://ik.imagekit.io/fhmcv0atw/sample-video.mp4?updatedAt=1746980203570"
            type="video/mp4"
          />
        </video>

        {/* Play Button Overlay when paused */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={togglePlay}
              className="bg-[#DDFF00] text-black rounded-full p-4 hover:bg-[#c4e600] transition-colors"
            >
              <Play size={48} fill="currentColor" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DemoVideo;
