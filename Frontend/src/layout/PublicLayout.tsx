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

    scrollInstance.current = new LocomotiveScroll({
      el: scrollRef.current,
      smooth: true,
      smartphone: { smooth: true },
      tablet: { smooth: true, breakpoint: 768 },
      multiplier: 1,
      class: "is-reveal",
    });

    const onLoad = () => scrollInstance.current?.update();
    const onResize = () => scrollInstance.current?.update();

    window.addEventListener("load", onLoad);
    window.addEventListener("resize", onResize);

    const delayedUpdate = setTimeout(() => scrollInstance.current?.update(), 500);

    return () => {
      clearTimeout(delayedUpdate);
      window.removeEventListener("load", onLoad);
      window.removeEventListener("resize", onResize);
      scrollInstance.current?.destroy();
      scrollInstance.current = null;
    };
  }, []);

  // Update scroll on route changes
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
