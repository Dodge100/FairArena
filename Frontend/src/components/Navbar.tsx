import { useEffect, useState } from "react";
import { useTheme } from "../theme-context";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";
import ThemeToggleButton from "./ui/ThemeChange";
import { Link } from "react-router";
import fairArenaLogo from "../../public/fairArenaLogo.png"
export default function Navbar() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setIsDark(theme === "dark");
  }, [theme]);

  return (
    <>
      {/* NAVBAR */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`w-full fixed top-0 overflow-hidden h-30 left-0 flex justify-center py-6 transition-colors duration-300 z-50`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={`
            flex items-center justify-between w-[72%] md:w-auto gap-10 px-4 md:py-4 py-2 rounded-full transition-all duration-300
            border
            ${
              isDark
                ? "bg-[#0a0a0a] border-[#222]"
                : "bg-[#ffffff] border-[#b4b4b4]"
            }
          `}
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className={`font-semibold ml-4 text-lg transition-colors ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            <Link to="/home" ><img width="100" src={fairArenaLogo} alt="" /></Link>
          </motion.div>

          {/* Desktop Nav */}
          <div
            className={`hidden md:flex items-center gap-10 text-sm transition-colors ${
              isDark ? "text-white/80" : "text-black/70"
            }`}
          >
            {["benefits", "how-it-works", "testimonials", "FAQ"].map(
              (item, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.1, duration: 0.4 }}
                  className={`${
                    isDark ? "hover:text-white" : "hover:text-black"
                  } transition cursor-pointer capitalize`}
                >
                  <Link to={item}>{item}</Link>
                </motion.button>
              )
            )}

            {/* Desktop CTA */}
            <Link to={"/signup"}>
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4 }}
              className={`ml-6 sm:flex hidden font-semibold px-6 py-2 rounded-full transition-all duration-300 cursor-pointer 
              ${
                isDark
                  ? "bg-[#d9ff00] text-black shadow-[0_0_15px_4px_rgba(217,255,0,0.4)] hover:shadow-[0_0_25px_10px_rgba(217,255,0,0.6)]"
                  : "bg-[#d9ff00] text-black shadow-[0_0_15px_4px_rgba(217,255,0,0.4)] hover:shadow-[0_0_25px_10px_rgba(217,255,0,0.6)]"
              }`}
            >
              Sign Up
            </motion.button></Link>
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className={`md:hidden p-2 rounded-lg transition ${
              isDark ? "text-white" : "text-black"
            }`}
            onClick={() => setOpen(true)}
          >
            <Menu size={28} />
          </motion.button>
        </motion.div>

        <ThemeToggleButton className={"hidden absolute lg:flex lg:top-1/2 right-10 -translate-x-1/2 -translate-y-1/2"} />
      </motion.div>

      {/* PANEL + BACKDROP WITH AnimatePresence */}
      <AnimatePresence>
        {open && (
          <>
            {/* BACKDROP - Render first to avoid z-index issues */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55]"
              style={{ willChange: "opacity" }}
            />

            {/* RIGHT PANEL */}
            <motion.div
              key="panel"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ 
                type: "tween",
                ease: [0.4, 0, 0.2, 1],
                duration: 0.35
              }}
              style={{ willChange: "transform, opacity" }}
              className={`fixed top-0 right-0 h-full w-[80%] max-w-[330px] z-[60] shadow-xl p-6
                border-l
                ${
                  isDark
                    ? "bg-[#0a0a0a] border-[#222] text-white"
                    : "bg-white border-[#b4b4b4] text-black"
                }
              `}
            >
              {/* Close Btn */}
              <div className="flex justify-end mb-8">
                <motion.button
                  initial={{ opacity: 0, rotate: -30 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.2, duration: 0.25, ease: "easeOut" }}
                  onClick={() => setOpen(false)}
                >
                  <X size={28} className={`${isDark ? "text-white" : "text-black"}`} />
                </motion.button>
              </div>

              {/* Panel Items – stagger */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { 
                      staggerChildren: 0.08,
                      delayChildren: 0.1
                    },
                  },
                }}
                className="flex flex-col gap-6 text-lg"
              >
                {["benefits", "how-it-works", "testimonials", "FAQ"].map(
                  (item, i) => (
                    <motion.button
                      key={i}
                      variants={{
                        hidden: { opacity: 0, x: 20 },
                        visible: { 
                          opacity: 1, 
                          x: 0,
                          transition: { 
                            duration: 0.3,
                            ease: "easeOut"
                          }
                        },
                      }}
                      className={`${
                        isDark ? "hover:text-white" : "hover:text-black"
                      } transition capitalize cursor-pointer`}
                      onClick={() => setOpen(false)}
                    >
                      <Link to={item} >{item}</Link>
                    </motion.button>
                  )
                )}
              </motion.div>

              {/* CTA BUTTON WITH FADE-UP */}
              <Link to="/signup">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3, ease: "easeOut" }}
                className={`mt-10 w-full font-semibold px-6 py-3 rounded-full
                  bg-[#d9ff00] text-black shadow-[0_0_15px_4px_rgba(217,255,0,0.4)]
                  hover:shadow-[0_0_25px_10px_rgba(217,255,0,0.6)]
                  transition-all duration-300 cursor-pointer
                `}
              >
                Sign Up
              </motion.button></Link>
              <div className="w-full flex items-center mt-5 justify-center">
              <ThemeToggleButton className={"flex"}/>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
