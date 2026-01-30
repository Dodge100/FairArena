import { Star } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { LazyImage } from './ui/LazyImage';

const testimonials = [
    {
        name: "Alex Rivera",
        role: "Hackathon Organizer",
        text: "FairArena completely changed how we handle judging. The AI insights are scary accurate!",
        avatar: "https://randomuser.me/api/portraits/men/32.jpg"
    },
    {
        name: "Sarah Chen",
        role: "Tech Lead",
        text: "Finally, a platform that makes grading fair. No more bias, just pure data-driven results.",
        avatar: "https://randomuser.me/api/portraits/women/44.jpg"
    },
    {
        name: "James Wilson",
        role: "Event Manager",
        text: "The dashboard is incredibly intuitive. I saved hours on admin work.",
        avatar: "https://randomuser.me/api/portraits/men/86.jpg"
    },
    {
        name: "Emily Davis",
        role: "Judge @ HackGlobal",
        text: "I love the rubric system. It makes scoring so much more consistent across different judges.",
        avatar: "https://randomuser.me/api/portraits/women/68.jpg"
    },
    {
        name: "Michael Brown",
        role: "Participant",
        text: "Getting feedback on my code uniqueness and SEO score was super helpful for my project.",
        avatar: "https://randomuser.me/api/portraits/men/15.jpg"
    }
];

export default function Testimonials() {
    const { isDark } = useTheme();

    return (
        <section className="py-24 relative w-full overflow-hidden bg-background">
            <div className="container mx-auto px-4 mb-16 text-center">
                <h2 className={cn("text-3xl md:text-5xl font-bold mb-6", isDark ? "text-white" : "text-black")}>
                    Loved by the Community
                </h2>
                <p className={cn("text-lg max-w-2xl mx-auto", isDark ? "text-neutral-400" : "text-neutral-600")}>
                    Don't just take our word for it. Here is what organizers and participants have to say per fair judging.
                </p>
            </div>

            <div className="relative w-full overflow-hidden">
                {/* Gradient Masks */}
                <div className={cn(
                    "absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none",
                    isDark ? "from-black" : "from-white"
                )} />
                <div className={cn(
                    "absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none",
                    isDark ? "from-black" : "from-white"
                )} />

                <div className="flex w-full overflow-hidden group">
                    <div className="flex animate-loop-scroll space-x-6 min-w-full pl-6">
                        {[...testimonials, ...testimonials].map((t, i) => ( // Duplicated for seamless loop
                            <div
                                key={i}
                                className={cn(
                                    "flex-none w-[300px] md:w-[400px] p-6 rounded-2xl border backdrop-blur-sm transition-colors",
                                    isDark
                                        ? "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700"
                                        : "bg-neutral-50 border-neutral-200 hover:border-neutral-300"
                                )}
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <LazyImage src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover bg-neutral-200" />
                                    <div>
                                        <h4 className={cn("font-bold", isDark ? "text-white" : "text-black")}>{t.name}</h4>
                                        <p className={cn("text-xs uppercase tracking-wider font-medium", isDark ? "text-neutral-500" : "text-neutral-400")}>{t.role}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 mb-3">
                                    {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} className="fill-[#d9ff00] text-[#d9ff00]" />)}
                                </div>
                                <p className={cn("text-sm leading-relaxed", isDark ? "text-neutral-300" : "text-neutral-600")}>
                                    "{t.text}"
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="flex animate-loop-scroll space-x-6 min-w-full ml-6" aria-hidden="true">
                        {[...testimonials, ...testimonials].map((t, i) => ( // Duplicated for seamless loop
                            <div
                                key={i}
                                className={cn(
                                    "flex-none w-[300px] md:w-[400px] p-6 rounded-2xl border backdrop-blur-sm transition-colors",
                                    isDark
                                        ? "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700"
                                        : "bg-neutral-50 border-neutral-200 hover:border-neutral-300"
                                )}
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <LazyImage src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover bg-neutral-200" />
                                    <div>
                                        <h4 className={cn("font-bold", isDark ? "text-white" : "text-black")}>{t.name}</h4>
                                        <p className={cn("text-xs uppercase tracking-wider font-medium", isDark ? "text-neutral-500" : "text-neutral-400")}>{t.role}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 mb-3">
                                    {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} className="fill-[#d9ff00] text-[#d9ff00]" />)}
                                </div>
                                <p className={cn("text-sm leading-relaxed", isDark ? "text-neutral-300" : "text-neutral-600")}>
                                    "{t.text}"
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes loop-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        .animate-loop-scroll {
          animation: loop-scroll 40s linear infinite;
        }
      `}</style>
        </section>
    );
}
