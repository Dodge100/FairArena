/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

function NotFound() {
  const { isDark } = useTheme();

  return (
    <div
      className={`w-full h-screen flex flex-col items-center justify-center relative transition-colors duration-300
      `}
    >
      {/* BIG 404 Background */}
      <h1
        className={`absolute text-[30vw] font-extrabold select-none leading-none transition-colors duration-300
          ${isDark ? 'text-neutral-800' : 'text-neutral-300'}
        `}
      >
        404
      </h1>

      {/* Main Content */}
      <div className="relative flex flex-col items-center justify-center px-4">
        <img
          src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
          className="w-40 -my-5"
          alt=""
        />

        {/* Heading */}
        <h2
          className={`text-4xl w-full items-center justify-center flex flex-col sm:text-5xl md:text-6xl font-semibold transition-colors duration-300
            ${isDark ? 'text-white' : 'text-neutral-800'}
          `}
        >
          Sorry But This Page{' '}
          <span
            className="
              bg-linear-to-r
              from-[#DDFF00] to-[#9AC400]
              bg-clip-text text-transparent
            "
          >
            Not Exist!
          </span>
        </h2>

        {/* Subtext */}
        <p
          className={`mt-4 text-lg max-w-lg text-center mx-auto transition-colors duration-300
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
        >
          Looks like you took a wrong turn. But don't worry, even the best Person get lost
          sometimes!
        </p>

        {/* Return Home */}
        <Link
          to="/"
          className={`inline-block mt-6 underline underline-offset-4 transition-all duration-300
            ${isDark ? 'text-white hover:text-[#DDFF00]' : 'text-black hover:text-[#DDFF00]'}
          `}
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
