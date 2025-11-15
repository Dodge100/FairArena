import { useEffect, useState, useRef } from "react";
import LocomotiveScroll from "locomotive-scroll";
import dashboardDemo from "../../../public/dashboardDemo.jpg";
import { PlayIcon } from "lucide-react";
import { useTheme } from "../../theme-context";

function DemoVideo() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(theme === "dark");
  }, [theme]);

  useEffect(() => {
    const locomotiveScroll = new LocomotiveScroll({});
    return () => locomotiveScroll.destroy();
  }, []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const onPlayClick = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.muted = false;
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div
      data-scroll
      data-scroll-speed="0.7"
      className={`
        w-[90%] sm:w-[85%] md:w-[80%] lg:w-full
        max-w-7xl mx-auto
        h-auto
        mt-10 sm:mt-16 md:mt-20
        p-2
        bg-gradient-to-b from-[#DDFF00] ${isDark? "to-neutral-950 ":"to-neutral-400"}
        rounded-3xl
      `}
    >
      <div
        className={`
          w-full h-full relative overflow-hidden rounded-2xl
          ${isDark ? "bg-neutral-900" : "bg-white"}
        `}
      >
            {/* Video element — posters can be used as fallback */}
            <video
              ref={videoRef}
              src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
              className="w-full max-w-full h-auto object-cover rounded-2xl"
              autoPlay={true}
              loop
              muted
            />
      </div>
    </div>
  );
}

export default DemoVideo;
