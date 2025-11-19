import React from "react";
import { Linkedin, Instagram, Facebook, Twitter } from "lucide-react";

function Footer() {
  return (
    <footer className="w-full bg-gradient-to-b border-t-neutral-600 border-1 from-[#1a1a1a] to-[#0f0f0f] border-white/5 text-neutral-400 pt-16 pb-8 px-6 md:px-12 lg:px-20">
      {/* Top Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">

        {/* Brand + Social */}
        <div>
          <img src="./fairArenaLogotop.png" className="w-30 -mb-10 -mt-10 " alt="" />
          <p className="mt-4 text-sm leading-relaxed">
            Follow us and never miss an update on the latest tech, productivity,
            and digital growth insights.
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-4 mt-5">
            <Twitter className="w-5 h-5 text-[#DDFF00] hover:scale-110 duration-200 cursor-pointer" />
            <Linkedin className="w-5 h-5 text-[#DDFF00] hover:scale-110 duration-200 cursor-pointer" />
            <Facebook className="w-5 h-5 text-[#DDFF00] hover:scale-110 duration-200 cursor-pointer" />
            <Instagram className="w-5 h-5 text-[#DDFF00] hover:scale-110 duration-200 cursor-pointer" />
          </div>
        </div>

        {/* Menu */}
        <div className="">
          <h3 className="text-lg font-semibold text-white">Menu</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="hover:text-[#DDFF00] cursor-pointer">Features</li>
            <li className="hover:text-[#DDFF00] cursor-pointer">How It Works</li>
            <li className="hover:text-[#DDFF00] cursor-pointer">Testimonials</li>
            <li className="hover:text-[#DDFF00] cursor-pointer">Pricing</li>
          </ul>
        </div>

        {/* Resources */}
        <div>
          <h3 className="text-lg font-semibold text-white">Resources</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="hover:text-[#DDFF00] cursor-pointer">Blog</li>
            <li className="hover:text-[#DDFF00] cursor-pointer">Newsletter</li>
            <li className="hover:text-[#DDFF00] cursor-pointer">Career</li>
            <li className="hover:text-[#DDFF00] cursor-pointer">Ebooks & Guides</li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-lg font-semibold text-white">Contact</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="hover:text-[#DDFF00] cursor-pointer">
            fairarena.contact@gmail.com
            </li>
            <li className="hover:text-[#DDFF00] cursor-pointer">
              Delhi, India
            </li>
          </ul>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-neutral-700 mt-12"></div>

      {/* Bottom Section */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-6 text-sm">
        <p className="text-neutral-500">
          © 2025 FairArena. All rights reserved.
        </p>

        <div className="flex gap-6 mt-4 md:mt-0">
          <p className="hover:text-[#DDFF00] cursor-pointer">Privacy Policy</p>
          <p className="hover:text-[#DDFF00] cursor-pointer">Terms of Use</p>
        </div>

        <p className="mt-4 md:mt-0 text-neutral-500">
          Built with ❤️ by FairArena Team
        </p>
      </div>
    </footer>
  );
}

export default Footer;
