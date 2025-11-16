import { Spotlight } from "./ui/Spotlight";
import { Waitlist } from "@clerk/clerk-react";
import { useTheme } from "../theme-context";

function WaitList() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`
        w-full h-screen flex flex-col items-center
      `}
    >
      {/* Spotlight */}
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill={isDark ? "#DDFF00" : "#b5c800"}
      />

      {/* Content */}
      <div className="max-w-9xl flex flex-col items-center relative z-20 gap-6">

        {/* Logo */}
        <img src="/fairArenaLogotop.png" className="w-40" alt="Fair Arena Logo" />

        {/* Heading */}
        <h2
          className={`
            text-3xl md:text-5xl font-semibold text-center
            ${isDark ? "text-neutral-100" : "text-neutral-900"}
          `}
        >
          You can Wait till{" "}
          <span className={`${isDark ? "text-[#ddef00]" : "text-[#1f1f1f]"}`}>
            Launch!
          </span>
        </h2>

        {/* Waitlist Card Wrapper */}
        <div className="w-full flex justify-center">
          <div
            className={`
              p-1 rounded-4xl backdrop-blur-md w-auto max-w-md border
              ${
                isDark
                  ? "bg-[#ddef00] border-neutral-800"
                  : "bg-black border-neutral-300"
              }
            `}
          >
            {/* Clerk Waitlist */}
            <Waitlist
              appearance={{
                variables: {
                  colorText: isDark ? "#F5F5F5" : "#111",
                  colorTextSecondary: isDark ? "#A1A1A1" : "#555",
                  colorBackground: "transparent",
                  borderRadius: "14px",
                  fontFamily: "Poppins, sans-serif",
                },
                elements: {
                  rootBox: `
                    ${isDark ? "!bg-neutral-900" : "!bg-white"}
                    rounded-4xl !shadow-none
                  `,

                  card: `
                    ${
                      isDark
                        ? "!bg-[rgba(15,15,15,0.65)] !border-neutral-800"
                        : "!bg-white !border-neutral-300"
                    }
                    !backdrop-blur-xl !border !shadow-none !rounded-2xl
                  `,

                  headerTitle: `
                    ${isDark ? "text-neutral-100" : "text-neutral-900"}
                    text-xl font-semibold
                  `,

                  headerSubtitle: `
                    ${isDark ? "text-neutral-400" : "text-neutral-600"}
                    text-sm
                  `,

                  formFieldLabel: `${isDark ? "text-neutral-300" : "text-neutral-700"}`,
                  formFieldErrorText: "text-red-500 text-sm",

                  formFieldInput: `
                    ${
                      isDark
                        ? "bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B]"
                        : "bg-white text-neutral-900 border-neutral-300"
                    }
                    placeholder:text-[#777]
                    focus:border-[#DDEF00] focus:ring-0 rounded-xl
                  `,

                  formButtonPrimary: `
                    ${
                      isDark
                        ? "bg-[#DDEF00] text-black"
                        : "bg-black text-white"
                    }
                    font-semibold rounded-xl py-2 transition
                  `,

                  footer: `${isDark ? "text-neutral-400" : "text-neutral-700"}`,
                  footerActionLink: `${
                    isDark ? "text-[#DDEF00]" : "text-black"
                  } hover:underline`,
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default WaitList;
