import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";

function Newsletter() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");

  const handleSubscribe = () => {
    if (!email.trim()) return alert("Please enter your email.");
    alert(`Subscribed: ${email}`);
    setEmail("");
  };

  return (
    <div
      className={`
        mb-20 px-4 sm:px-6 py-12 sm:py-14
        rounded-3xl
        max-w-3xl md:max-w-4xl lg:max-w-5xl
        mx-auto
        transition
      `}
    >
      {/* Subtitle */}
      <p
        className={`
          mt-6 sm:mt-10 text-center font-semibold
          text-[28px] sm:text-4xl md:text-5xl leading-snug
          ${isDark ? "text-neutral-100" : "text-neutral-800"}
        `}
      >
        Stay Updated With <span className="text-neutral-500">Fair Arena</span>
      </p>

      {/* Description */}
      <p
        className={`
          text-center mt-3 max-w-md sm:max-w-xl mx-auto 
          text-xs sm:text-sm md:text-base
          ${isDark ? "text-neutral-400" : "text-neutral-600"}
        `}
      >
        Subscribe to our newsletter and get updates about new features,
        upcoming hackathon tools, AI scoring upgrades, and more.
      </p>

      {/* Input + Button */}
      <div
        className={`
          flex flex-col sm:flex-row items-center 
          gap-4 mt-8 w-full
          px-2 sm:px-0
        `}
      >
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Enter your email"
          className={`
            w-full sm:flex-1
            px-5 py-3 rounded-full text-sm md:text-base outline-none
            ${
              isDark
                ? "bg-neutral-800 text-white placeholder-neutral-500 border border-neutral-700"
                : "bg-white text-black placeholder-neutral-500 border border-neutral-300"
            }
          `}
        />

        <button
          onClick={handleSubscribe}
          className="
            w-full sm:w-auto
            px-8 py-3 text-sm md:text-base text-black font-semibold
            rounded-full bg-[#ddef00]
            hover:bg-[#ddef00]/80 transition
          "
        >
          Subscribe
        </button>
      </div>
    </div>
  );
}

export default Newsletter;
