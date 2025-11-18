import { SignIn } from '@clerk/clerk-react';
import { useTheme } from '../hooks/useTheme';

export default function Signin() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const appearance = {
    variables: {
      colorPrimary: '#DDEF00',
      colorText: isDark ? '#F5F5F5' : '#111111',
      colorTextSecondary: isDark ? '#A1A1A1' : '#555555',
      colorBackground: isDark ? '#0d0d0d' : '#FFFFFF',
      colorInputBackground: isDark ? '#1A1A1A' : '#FFFFFF',
      colorInputText: isDark ? '#F5F5F5' : '#111111',
      borderRadius: '12px',
      fontFamily: 'Inter, sans-serif',
    },

    elements: {
      // ---------- CARD ----------
      card: `
        ${isDark ? '!bg-[#0d0d0d]' : '!bg-white'}
        !border
        ${isDark ? '!border-neutral-800' : '!border-[#e6e6e6]'}
        !rounded-2xl
        !shadow-none
        w-full
      `,

      // ---------- HEADER ----------
      headerTitle: `
        text-2xl font-semibold
        ${isDark ? 'text-white' : 'text-neutral-900'}
      `,
      headerSubtitle: `
        ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
        text-sm
      `,

      // ---------- LABEL ----------
      formFieldLabel: `
        ${isDark ? 'text-neutral-300' : 'text-neutral-700'}
      `,

      // ---------- INPUT ----------
      formFieldInput: `
        ${
          isDark
            ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B]'
            : 'bg-white text-neutral-900 border-[#e6e6e6]'
        }
        rounded-lg placeholder:text-neutral-400
        focus:border-[#DDEF00]
        focus:ring-0
      `,

      // ---------- BUTTON ----------
      formButtonPrimary: `
        bg-[#DDEF00] text-black
        rounded-lg py-2 font-semibold
        transition-transform active:scale-95
      `,

      // ---------- FOOTER (FIXED TO MATCH WAITLIST) ----------
      cardFooter: `
        ${isDark ? '!bg-[#0d0d0d] !border-neutral-800' : '!bg-white'}
        !rounded-b-2xl
        ${isDark ? '!text-white !text-white/100' : '!text-black !text-black/100'}
      `,

      formFooter: `
        ${isDark ? '!bg-[#0d0d0d]' : '!bg-white'}
        ${isDark ? '!text-white !text-white/100' : '!text-black !text-black/100'}
      `,

      footer: `
        ${isDark ? '!text-white !text-white/100' : '!text-black !text-black/100'}
      `,

      footerText: `
        ${isDark ? '!text-white !text-white/100' : '!text-black !text-black/100'}
      `,

      footerActionLink: `
        ${isDark ? '!text-[#DDEF00] !text-[#DDEF00]/100' : '!text-black !text-black/100'}
        hover:underline
      `,

      footerAction: `
        ${isDark ? '!text-white !text-white/100' : '!text-black !text-black/100'}
      `,

      footerActionText: `
        ${isDark ? '!text-white !text-white/100' : '!text-black !text-black/100'}
      `,

      dividerLine: `
        ${isDark ? '!bg-neutral-800' : '!bg-neutral-200'}
      `,

      dividerText: `
        ${isDark ? '!text-white !text-white/100' : '!text-black !text-black/100'}
      `,

      identityPreviewText: `
        ${isDark ? '!text-white !text-white/100' : '!text-black !text-black/100'}
      `,

      identityPreviewEditButton: `
        ${isDark ? '!text-white !text-white/100' : '!text-black !text-black/100'}
      `,

      formResendCodeLink: `
        ${isDark ? '!text-[#DDEF00] !text-[#DDEF00]/100' : '!text-black !text-black/100'}
      `,

      otpCodeFieldInput: `
        ${isDark ? 'bg-[#1A1A1A] text-white border-[#2B2B2B]' : 'bg-white text-black border-[#e6e6e6]'}
      `,

      // ---------- SSO SOCIAL BUTTONS ----------
      socialButtons: `
        bg-[#DDEF00]
        hover:bg-[#c7db00]
        text-black
        !rounded-lg
        !border-0
      `,

      socialButtonsBlockButton: `
        bg-[#DDEF00]
        hover:bg-[#c7db00]
        text-black
        !rounded-lg
        !border-0
        py-2
        font-medium
      `,

      socialButtonsIconButton: `
        bg-[#DDEF00]
        text-black
        !rounded-lg
        !border-0
      `,

      socialButtonsProviderIcon: `
        text-black
        opacity-100
      `,
    },
  };

  return (
    <div
      className={`
        fixed inset-0 w-full min-h-screen flex items-center justify-center overflow-hidden
        ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}
      `}
    >
      {/* MAIN CONTAINER */}
      <div
        className={`
          w-full h-screen
          flex flex-col md:flex-row rounded-none overflow-hidden
          shadow-[0_0_80px_rgba(0,0,0,0.2)]
        `}
      >
        {/* LEFT SIDE — AUTH FORM */}
        <div
          className={`
            w-full md:w-1/2  flex flex-col py-5 items-center justify-start h-auto overflow-scroll overflow-x-hidden no-scrollbar
            ${isDark ? 'bg-neutral-900' : 'bg-white'}
          `}
        >
          <img src="/fairArenaLogotop.png" className="w-30" alt="Fair Arena Logo" />
          <h1
            className={`
              text-3xl font-bold mb-1
              ${isDark ? 'text-white' : 'text-neutral-900'}
            `}
          >
            Welcome Back
          </h1>

          <p
            className={`
              mb-3
              ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
            `}
          >
            Enter your credentials to access your account.
          </p>

          <div className="w-full max-w-sm">
            <SignIn appearance={appearance} redirectUrl={'/dashboard'} />
          </div>
        </div>

        {/* RIGHT SIDE — ILLUSTRATION */}
        <div
          className={`
            hidden md:flex w-1/2 items-center justify-center p-6
            ${
              isDark
                ? 'bg-[#0f0f0f] border-l border-neutral-800'
                : 'bg-[#EEF0FF] border-l border-neutral-200'
            }
          `}
        >
          <div className="relative w-full max-w-md">
            <h2
              className={`
                text-2xl font-semibold mb-4
                ${isDark ? 'text-white' : 'text-neutral-900'}
              `}
            >
              Perfectly Judge Hackathon Teams and View LeaderBoards.
            </h2>
            <p
              className={`
                mb-6 text-sm
                ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
              `}
            >
              Log in to access your CRM dashboard and manage your team.
            </p>

            <img
              src="/dashboardDemo.jpg"
              alt="Dashboard Preview"
              className="rounded-xl shadow-lg border"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
