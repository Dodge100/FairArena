import { useTheme } from '../hooks/useTheme';

export default function DashboardSkeleton() {
    const { isDark } = useTheme();

    return (
        <div className={`min-h-screen ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}`}>
            {/* Skeleton content */}
            <div className="animate-pulse p-8">
                <div className={`h-8 w-64 rounded-lg mb-8 ${isDark ? 'bg-neutral-800' : 'bg-gray-300'}`} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`h-32 rounded-xl ${isDark ? 'bg-neutral-900' : 'bg-white'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
