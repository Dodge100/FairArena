import LocomotiveScroll from "locomotive-scroll";
import "locomotive-scroll/dist/locomotive-scroll.css";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function PublicLayout() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollInstance = useRef<LocomotiveScroll | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (!scrollRef.current) return;

    // Initialize LocomotiveScroll and keep instance in ref so we can call update()
    scrollInstance.current = new LocomotiveScroll({
      el: scrollRef.current,
      smooth: true,
      // Enable smooth on mobile/tablet to avoid layout jumps on smaller screens
      smartphone: { smooth: true },
      tablet: { smooth: true, breakpoint: 768 },
      multiplier: 1,
      class: "is-reveal",
    });

    const onLoad = () => scrollInstance.current?.update();
    const onResize = () => scrollInstance.current?.update();

    // Update after window load and on resize to ensure correct heights
    window.addEventListener("load", onLoad);
    window.addEventListener("resize", onResize);

    // Small delayed update to account for async content (images/videos)
    const delayedUpdate = setTimeout(() => scrollInstance.current?.update(), 500);

    return () => {
      clearTimeout(delayedUpdate);
      window.removeEventListener("load", onLoad);
      window.removeEventListener("resize", onResize);
      scrollInstance.current?.destroy();
      scrollInstance.current = null;
    };
  }, []);

  // When route changes, update locomotive so it recalculates size/positions
  useEffect(() => {
    scrollInstance.current?.update();
  }, [location]);

  return (
    <>
      <Navbar />
      <div ref={scrollRef} data-scroll-container className="flex flex-col items-center">
        <Outlet />
      </div>
    </>
  );
}
