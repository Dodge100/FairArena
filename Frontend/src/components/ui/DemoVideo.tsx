import { useEffect, useState } from "react";
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

  return (
    <div
      data-scroll
      data-scroll-speed="0.7"
      className={`
        w-[90%] sm:w-[85%] md:w-[80%] lg:w-full 
        max-w-7xl mx-auto
        h-auto
        -mt-20 sm:-mt-32 md:-mt-16
        p-2
        bg-gradient-to-b from-[#DDFF00] ${isDark?"to-neutral-950 ":"to-neutral-400"} 
        rounded-3xl
      `}
    >
      <div
        className={`
          w-full h-full relative overflow-hidden rounded-2xl
          ${isDark ? "bg-neutral-900" : "bg-white"}
        `}
      >
        <img
          src={dashboardDemo}
          className="w-full max-w-full h-auto object-cover rounded-2xl"
          alt="Dashboard Demo"
        />

        {/* Play Button — Theme Based */}
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div
            className={`
              w-20 h-20 rounded-full flex items-center justify-center cursor-pointer
              backdrop-blur-md transition-all duration-300 hover:scale-110

              ${isDark
                ? "bg-[#DDFF00]/80 shadow-[0_0_25px_rgba(221,255,0,0.5)]"
                : "bg-white/90 shadow-[0_0_20px_rgba(0,0,0,0.12)] border border-black/20"}
            `}
          >
            <PlayIcon
              size={48}
              className={`${isDark ? "text-black" : "text-black"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemoVideo;
