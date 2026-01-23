import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import { ArrowRight, Play, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useAuthState } from '../lib/auth';
import { cn } from '../lib/utils';
import { AnimatedShinyText } from './ui/animated-shiny-text';
import { Spotlight } from './ui/Spotlight';

export default function Hero() {
    const { isDark } = useTheme();
    const { isSignedIn } = useAuthState();
    const isNewSignupEnabled = import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true';

    return (
        <div className="relative w-full min-h-[90vh] flex flex-col items-center justify-start pt-40 pb-20 overflow-hidden">
            {/* Background Grid */}
            <div
                className={cn(
                    "absolute inset-0 pointer-events-none z-0",
                    isDark
                        ? "bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
                        : "bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
                )}
            />

            <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill={isDark ? "#d9ff00" : "#a3c200"} />

            <div className="relative z-10 container mx-auto px-4 flex flex-col items-center text-center">

                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={cn(
                        "rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-md mb-8 flex items-center gap-2",
                        isDark
                            ? "bg-neutral-900/50 border-neutral-700 text-neutral-300"
                            : "bg-white/50 border-neutral-200 text-neutral-600"
                    )}
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d9ff00] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d9ff00]"></span>
                    </span>
                    <AnimatedShinyText className="inline-flex items-center justify-center transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
                        <span>FairArena v1.0 is now live</span>
                        <ArrowRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
                    </AnimatedShinyText>
                </motion.div>

                {/* Heading */}
                <motion.h1
                    className={cn(
                        "text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 max-w-5xl",
                        isDark ? "text-white" : "text-gray-900"
                    )}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
                >
                    The Platform for <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d9ff00] to-[#9db800]">
                        Fair Decisions
                    </span>
                </motion.h1>

                {/* Subheading */}
                <motion.p
                    className={cn(
                        "text-lg md:text-xl max-w-2xl mb-10 leading-relaxed",
                        isDark ? "text-neutral-400" : "text-neutral-600"
                    )}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
                >
                    FairArena is the AI-powered hackathon platform for organizers, judges, and participants. We automate judging with analysis and real-time insights, ensuring fair evaluations for everyone.
                </motion.p>

                {/* Buttons */}
                <motion.div
                    className="flex flex-col items-center gap-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
                >
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        {!isSignedIn ? (
                            <Link to={isNewSignupEnabled ? '/signin' : '/waitlist'}>
                                <button className="relative group overflow-hidden pl-6 h-14 rounded-full bg-[#d9ff00] text-neutral-950 font-semibold text-lg hover:shadow-[0_0_20px_rgba(217,255,0,0.5)] transition-all duration-300">
                                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shiny-text"></span>
                                    <div className="flex items-center gap-2 pr-6">
                                        {isNewSignupEnabled ? 'Get Started' : 'Join Waitlist'}
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            </Link>
                        ) : (
                            <Link to="/dashboard">
                                <button className="relative group overflow-hidden pl-6 h-14 rounded-full bg-[#d9ff00] text-neutral-950 font-semibold text-lg hover:shadow-[0_0_20px_rgba(217,255,0,0.5)] transition-all duration-300">
                                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shiny-text"></span>
                                    <div className="flex items-center gap-2 pr-6">
                                        Go to Dashboard
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            </Link>
                        )}

                        <a href="#demo" className={cn(
                            "h-14 px-8 rounded-full flex items-center gap-2 font-medium transition-all border",
                            isDark
                                ? "border-neutral-700 hover:bg-neutral-800 text-white"
                                : "border-neutral-300 hover:bg-neutral-100 text-gray-900"
                        )}>
                            <Play className="w-4 h-4 fill-current" />
                            Watch Demo
                        </a>
                    </div>

                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className="mt-20 flex flex-col items-center gap-4"
                >
                    <div className="flex flex-row flex-wrap items-center gap-12">
                        <div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:grayscale">
                            <Avatar>
                                <AvatarImage src="https://github.com/saksham-goel1107.png" alt="Saksham-Goel1107" />
                                <AvatarFallback>SG</AvatarFallback>
                            </Avatar>
                            <Avatar>
                                <AvatarImage
                                    src="https://github.com/fairarena.png"
                                    alt="FairArena"
                                />
                                <AvatarFallback>FA</AvatarFallback>
                            </Avatar>
                            <Avatar>
                                <AvatarImage
                                    src="https://github.com/sachinpal11.png"
                                    alt="@sachinpal11"
                                />
                                <AvatarFallback>SP</AvatarFallback>
                            </Avatar>
                            <Avatar>
                                <AvatarImage
                                    src="https://github.com/Harsh091234.png"
                                    alt="@Harsh091234"
                                />
                                <AvatarFallback>HS</AvatarFallback>
                            </Avatar>
                            <Avatar>
                                <AvatarImage
                                    src="https://github.com/prabsingh005.png"
                                    alt="@prabsingh005"
                                />
                                <AvatarFallback>PS</AvatarFallback>
                            </Avatar>
                            <Avatar>
                                <AvatarImage
                                    src="https://github.com/rohitshandilya01.png"
                                    alt="@rohitshandilya01"
                                />
                                <AvatarFallback>RS</AvatarFallback>
                            </Avatar>
                            <Avatar>
                                <AvatarImage
                                    src="https://github.com/arsh118.png"
                                    alt="@arsh118"
                                />
                                <AvatarFallback>AA</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((_, i) => (
                                <Star key={i} className="w-4 h-4 fill-[#d9ff00] text-[#d9ff00]" />
                            ))}
                        </div>
                        <p className={cn("text-sm", isDark ? "text-neutral-400" : "text-neutral-600")}>Trusted by organizers worldwide</p>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
