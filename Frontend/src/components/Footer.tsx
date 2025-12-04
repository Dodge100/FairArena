import { useTheme } from '@/hooks/useTheme';
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import InviteFriend from './InviteFriend';

function Footer() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  return (
    <footer
      className={`
        w-full pt-16 pb-8 px-6 md:px-12 lg:px-20 border-t
        ${
          isDark
            ? 'bg-linear-to-b from-[#1a1a1a] to-[#0f0f0f] border-white/10 text-neutral-400'
            : 'bg-linear-to-b from-[#ffffff] to-[#f2f2f2] border-black/10 text-neutral-700'
        }
      `}
    >
      {/* Top Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Brand + Social */}
        <div>
          <img src="/fairArenaLogotop.png" className="w-30 -mb-10 -mt-10" alt="FairArena Logo" />
          <p
            className={`mt-4 text-sm leading-relaxed ${
              isDark ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            Follow us and never miss an update on the latest tech, productivity, and digital growth
            insights.
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-4 mt-5">
            {[Twitter, Linkedin, Facebook, Instagram].map((Icon, i) => (
              <Icon
                key={i}
                className={`
                  w-5 h-5 cursor-pointer duration-200 hover:scale-110
                  ${isDark ? 'text-[#DDFF00]' : 'text-[#556000] hover:text-[#8aa300]'}
                `}
              />
            ))}
          </div>
        </div>

        {/* Menu */}
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>Menu</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              { label: 'About', path: 'about' },
              { label: 'Why Choose Us', path: 'why-choose-us' },
              { label: 'Pricing', path: 'pricing' },
              { label: 'Status', path: 'https://z956gqbw.status.cron-job.org', external: true },
            ].map((item) => (
              <li
                key={item.path}
                className={`
                    cursor-pointer
                    ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
                  `}
              >
                {item.external ? (
                  <a href={item.path} target="_blank" rel="noopener noreferrer">
                    {item.label}
                  </a>
                ) : (
                  <Link to={`/${item.path}`}>{item.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Resources */}
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
            Resources
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {['Blog', 'Ebooks & Guides'].map((item) => (
              <li
                key={item}
                className={`
                  cursor-pointer
                  ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
                `}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
            Contact
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link
                to="/support"
                className={`
                  cursor-pointer
                  ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
                `}
              >
                Support
              </Link>
            </li>
            <li>
              <a
                href="mailto:fairarena.contact@gmail.com"
                rel="noopener noreferrer"
                className={`
                  cursor-pointer
                  ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
                `}
              >
                fairarena.contact@gmail.com
              </a>
            </li>
            <li
              className={`
                cursor-pointer
                ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
              `}
            >
              Delhi, India
            </li>
          </ul>
        </div>
      </div>

      {/* Invite Friends Section */}
      <div className="mt-6 w-full">
        <InviteFriend />
      </div>

      {/* Divider */}
      <div
        className={`mt-12 border-t ${isDark ? 'border-neutral-700' : 'border-neutral-300'}`}
      ></div>

      {/* Bottom Section */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-6 text-sm gap-4 md:gap-0">
        <p className={`${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
          © 2025 FairArena. All rights reserved.
        </p>

        <div className="flex gap-6">
          {['privacy-policy', 'terms-and-conditions'].map((item) => (
            <p
              key={item}
              className={`
                cursor-pointer capitalize
                ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
              `}
            >
              <Link to={`/${item}`}>{item.replace(/-/g, ' ')}</Link>
            </p>
          ))}
        </div>

        <p className={`${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
          Built with ❤️ by FairArena Team
        </p>
      </div>
    </footer>
  );
}

export default Footer;
