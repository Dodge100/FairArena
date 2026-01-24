import { useTheme } from '@/hooks/useTheme';
import { Github, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';
import InviteFriend from './InviteFriend';

import { useTranslation } from 'react-i18next';

function Footer() {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <footer
      className={`
        w-full pt-16 pb-8 px-6 md:px-12 lg:px-20 border-t
        ${isDark
          ? 'bg-linear-to-b from-[#1a1a1a] to-[#0f0f0f] border-white/10 text-neutral-400'
          : 'bg-linear-to-b from-[#ffffff] to-[#f2f2f2] border-black/10 text-neutral-700'
        }
      `}
    >
      {/* Top Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Brand + Social */}
        <div>
          <Link to="/">
            <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" className="w-30 -mb-10 -mt-10" alt="FairArena Logo" />
          </Link>
          <p
            className={`mt-4 text-sm leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'
              }`}
          >
            {t('footer.brand.desc')}
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-4 mt-5">
            <a href="https://github.com/FairArena" target="_blank" rel="noopener noreferrer">
              <Github
                className={`
                  w-5 h-5 cursor-pointer duration-200 hover:scale-110
                  ${isDark ? 'text-[#DDFF00]' : 'text-[#556000] hover:text-[#8aa300]'}
                `}
              />
            </a>
            <a href="https://www.linkedin.com/company/fairarena" target="_blank" rel="noopener noreferrer">
              <Linkedin
                className={`
                  w-5 h-5 cursor-pointer duration-200 hover:scale-110
                  ${isDark ? 'text-[#DDFF00]' : 'text-[#556000] hover:text-[#8aa300]'}
                `}
              />
            </a>
          </div>
        </div>

        {/* Menu */}
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>{t('footer.menu.title')}</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              { label: t('footer.menu.items.about'), path: 'about' },
              { label: t('footer.menu.items.whyChooseUs'), path: 'why-choose-us' },
              { label: t('footer.menu.items.changelog'), path: 'changelog' },
              { label: t('footer.menu.items.faq'), path: 'faq' },
              { label: t('footer.menu.items.pricing'), path: '#pricing', hash: true },
              { label: t('footer.menu.items.status'), path: 'status' },
            ].map((item) => (
              <li
                key={item.path}
                className={`
                    cursor-pointer
                    ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
                  `}
              >
                {item.hash ? (
                  <a href={item.path}>{item.label}</a>
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
            {t('footer.resources.title')}
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              { label: t('footer.resources.items.accessibility'), path: 'accessibility' },
              { label: t('footer.resources.items.communityGuidelines'), path: 'community-guidelines' },
              { label: t('footer.resources.items.securityPolicy'), path: 'security-policy' },
            ].map((item) => (
              <li
                key={item.path}
                className={`
                  cursor-pointer
                  ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
                `}
              >
                <Link to={`/${item.path}`}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
            {t('footer.contact.title')}
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
                {t('footer.contact.support')}
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
              {t('footer.contact.location')}
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
          © {new Date().getFullYear()} FairArena. {t('footer.bottom.rights')}
        </p>

        <div className="flex gap-6">
          {[
            { key: 'privacy-policy', label: t('footer.bottom.links.privacyPolicy') },
            { key: 'terms-and-conditions', label: t('footer.bottom.links.termsAndConditions') },
            { key: 'cookie-policy', label: t('footer.bottom.links.cookiePolicy') },
            { key: 'refund', label: t('footer.bottom.links.refund') },
            { key: 'dmca', label: t('footer.bottom.links.dmca') }
          ].map((item) => (
            <p
              key={item.key}
              className={`
                cursor-pointer capitalize
                ${isDark ? 'hover:text-[#DDFF00]' : 'hover:text-[#556000]'}
              `}
            >
              <Link to={`/${item.key}`}>{item.label}</Link>
            </p>
          ))}
        </div>

        <p className={`${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
          {t('footer.bottom.builtWith')}
        </p>
      </div>
    </footer>
  );
}

export default Footer;
