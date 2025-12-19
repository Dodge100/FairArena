import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataSaverUtils } from '@/hooks/useDataSaverUtils';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@clerk/clerk-react';
import { ArrowLeft, Moon, RefreshCw, Search, Star, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

interface StarData {
  id: string;
  userId: string;
  createdAt: string;
  starrer: {
    userId: string;
    name: string;
    avatarUrl?: string;
  };
}

export default function ProfileStars() {
  const { userId } = useParams<{ userId: string }>();
  const { theme, toggleTheme } = useTheme();
  const { cn } = useDataSaverUtils();
  const navigate = useNavigate();
  const [stars, setStars] = useState<StarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const { getToken } = useAuth();

  const fetchStars = useCallback(
    async (pageNum: number = 1) => {
      if (!userId) return;

      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(
          `${apiUrl}/api/v1/stars/profile/${userId}?page=${pageNum}&limit=20`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${await getToken()}`,
            },
            credentials: 'include',
          },
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('Profile not found');
          } else {
            throw new Error('Failed to fetch stars');
          }
          return;
        }

        const data = await response.json();

        if (pageNum === 1) {
          setStars(data.data.stars);
        } else {
          setStars((prev) => [...prev, ...data.data.stars]);
        }

        setHasMore(data.data.pagination.page < data.data.pagination.pages);
        setPage(pageNum);
      } catch (err) {
        console.error('Error fetching stars:', err);
        setError('Failed to load stars');
        toast.error('Failed to load stars');
      } finally {
        setLoading(false);
      }
    },
    [userId, getToken],
  );

  useEffect(() => {
    if (!userId) {
      setError('Profile not found');
      setLoading(false);
      return;
    }
    fetchStars();
  }, [fetchStars, userId]);

  const filteredStars = stars
    .filter((star) => star.starrer.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return a.starrer.name.localeCompare(b.starrer.name);
      }
    });

  const totalStars = stars.length;
  const starsThisMonth = stars.filter((star) => {
    const starDate = new Date(star.createdAt);
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    return starDate >= oneMonthAgo;
  }).length;

  const loadMore = () => {
    fetchStars(page + 1);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center text-destructive">{error}</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">Unable to load the stars for this profile.</p>
            <Button onClick={() => navigate(-1)} variant="outline" className="mr-2">
              Go Back
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_1px_1px,rgba(251,191,36,0.1)_1px,transparent_0)] bg-size-[20px_20px] bg-linear-to-br from-background to-yellow-50/20 dark:to-yellow-950/20">
      {/* Navigation Header */}
      <div className="w-full border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-screen-2xl mx-auto">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="w-10 h-10 rounded-full hover:bg-accent transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <a
                  href="https://fairarena.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <Star className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-lg text-foreground">FairArena</span>
                </a>
              </div>

              {/* Theme Toggle */}
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                  className="w-10 h-10 rounded-full hover:bg-accent/60 transition-colors flex items-center justify-center"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5 text-yellow-400" />
                  ) : (
                    <Moon className="h-5 w-5 text-slate-800" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fetchStars(1)}
                  disabled={loading}
                  aria-label="Refresh stars"
                  className="w-10 h-10 rounded-full hover:bg-accent/60 transition-colors flex items-center justify-center"
                >
                  <RefreshCw className={cn(`h-5 w-5 ${loading ? 'animate-spin' : ''}`)} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-linear-to-br from-yellow-400 to-orange-500 rounded-full mb-4 shadow-lg">
            <Star className="h-8 w-8 text-white fill-current" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-linear-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
            Profile Stars
          </h1>
          <p className="text-muted-foreground text-xl">People who appreciated this profile</p>
          {stars.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-full border border-yellow-200 dark:border-yellow-800">
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
              <span className="font-semibold text-yellow-700 dark:text-yellow-300">
                {filteredStars.length} star{filteredStars.length !== 1 ? 's' : ''}{' '}
                {filteredStars.length !== stars.length ? `of ${stars.length}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-8">
          <Input
            placeholder="Search stars by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'date' ? 'default' : 'outline'}
              size="lg"
              onClick={() => setSortBy('date')}
            >
              Recent First
            </Button>
            <Button
              variant={sortBy === 'name' ? 'default' : 'outline'}
              size="lg"
              onClick={() => setSortBy('name')}
            >
              Name A-Z
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stars.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-yellow-600">{totalStars}</div>
              <div className="text-base text-muted-foreground">Total Stars</div>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-yellow-600">{starsThisMonth}</div>
              <div className="text-base text-muted-foreground">Stars This Month</div>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-yellow-600">{filteredStars.length}</div>
              <div className="text-base text-muted-foreground">Showing Now</div>
            </Card>
          </div>
        )}

        {loading && stars.length === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-full" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : stars.length === 0 ? (
          <Card className="p-12 text-center border-dashed shadow-sm">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full mb-6">
              <Star className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
              No stars yet
            </h3>
            <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
              This profile hasn't received any stars yet. Be the first to show your appreciation!
            </p>
          </Card>
        ) : filteredStars.length === 0 ? (
          <Card className="p-12 text-center border-dashed shadow-sm">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full mb-6">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
              No matching stars
            </h3>
            <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
              Try adjusting your search or sort criteria.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredStars.map((star, index) => (
              <Card
                key={star.id}
                className={cn("p-8 hover:shadow-lg hover:shadow-yellow-200/50 dark:hover:shadow-yellow-900/50 transition-all duration-300 hover:scale-[1.02] border-l-4 border-l-yellow-400 shadow-sm cursor-pointer")}
                style={{
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.6s ease-out forwards',
                }}
                onClick={() => navigate(`/profile/${star.starrer.userId}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16 ring-2 ring-yellow-100 dark:ring-yellow-900/20">
                      <AvatarImage
                        src={star.starrer.avatarUrl}
                        alt={star.starrer.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-linear-to-br from-yellow-400 to-orange-500 text-white font-semibold">
                        {star.starrer.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center shadow-sm">
                      <Star className="h-4 w-4 text-white fill-current" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
                      {star.starrer.name}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>Starred</span>
                      <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                        {new Date(star.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-500">
                    <Star className={cn("h-8 w-8 fill-current animate-pulse")} />
                  </div>
                </div>
              </Card>
            ))}

            {hasMore && (
              <div className="text-center pt-6">
                <Button
                  onClick={loadMore}
                  disabled={loading}
                  variant="outline"
                  size="lg"
                  className={cn("px-8 py-3 border-yellow-200 hover:border-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 transition-all duration-200")}
                >
                  {loading ? (
                    <>
                      <div className={cn("animate-spin rounded-full h-4 w-4 border-2 border-yellow-500 border-t-transparent mr-2")} />
                      Loading...
                    </>
                  ) : (
                    <>Load More Stars</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full border-t bg-background/80 backdrop-blur-sm mt-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-muted-foreground">
            <p>© {new Date().getFullYear()} FairArena. Made with ❤️</p>
          </div>
        </div>
      </div>
    </div>
  );
}
