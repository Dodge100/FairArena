import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@clerk/clerk-react';
import { ArrowLeft, Eye, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ProfileView {
  id: string;
  viewerUserId: string;
  viewerEmail: string;
  viewerName: string | null;
  avatarUrl: string | null;
  viewedAt: string;
}

export default function ProfileViews() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [views, setViews] = useState<ProfileView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);

  useEffect(() => {
    const fetchProfileViews = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/v1/profile/views`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            try {
              const errorData = await response.json();
              // Check if the error indicates profile is missing
              if (errorData.error?.message === 'Profile not found') {
                setProfileMissing(true);
                return;
              }
            } catch (parseError) {
              // If we can't parse the error response, treat as generic 404
              console.warn('Failed to parse 404 error response:', parseError);
            }
            // For other 404 errors, treat as no views (backward compatibility)
            setViews([]);
            return;
          }
          throw new Error('Failed to fetch profile views');
        }

        const data = await response.json();
        setViews(data.data || []);
      } catch (err) {
        console.error('Error fetching profile views:', err);
        setError('Failed to load profile views');
        toast.error('Failed to load profile views');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileViews();
  }, [getToken]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-linear-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Eye className="h-8 w-8 text-primary" />
                Profile Views
              </h1>
              <p className="text-muted-foreground mt-1">Track who has viewed your profile</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Viewers</CardTitle>
                <CardDescription className="mt-1">
                  {profileMissing
                    ? 'Create a profile to start tracking views'
                    : views.length === 0
                      ? 'No one has viewed your profile yet'
                      : 'People who viewed your profile'}
                </CardDescription>
              </div>
              {!profileMissing && views.length > 0 && (
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold">
                  {views.length} {views.length === 1 ? 'view' : 'views'}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {error && <div className="text-center py-8 text-destructive">{error}</div>}
            {profileMissing && (
              <div className="text-center py-12">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Profile Not Found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  You need to create a profile before you can view profile statistics
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/dashboard/profile')}
                >
                  Create Profile
                </Button>
              </div>
            )}
            {!error && !profileMissing && views.length === 0 && (
              <div className="text-center py-12">
                <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No profile views yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Share your profile link to start tracking views
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/dashboard/profile')}
                >
                  Go to Profile
                </Button>
              </div>
            )}
            {!error && !profileMissing && views.length > 0 && (
              <div className="space-y-3">
                {views.map((view) => {
                  const initials = view.viewerName
                    ? view.viewerName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                    : view.viewerEmail[0].toUpperCase();

                  return (
                    <div
                      key={view.id}
                      className="flex items-center gap-4 p-5 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-all duration-200 group"
                    >
                      <Avatar className="h-14 w-14 ring-2 ring-offset-2 ring-offset-background ring-primary/20 group-hover:ring-primary/40 transition-all">
                        <AvatarImage
                          src={view.avatarUrl || undefined}
                          alt={view.viewerName || view.viewerEmail}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-foreground truncate">
                            {view.viewerName || 'Anonymous'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {view.viewerEmail}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="bg-muted/50 px-3 py-1.5 rounded-full">
                          <p className="text-xs font-medium text-muted-foreground">
                            {formatDate(view.viewedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
