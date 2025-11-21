import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/hooks/useTheme';
import { useUser } from '@clerk/clerk-react';
import {
  Briefcase,
  Calendar,
  Edit,
  FileText,
  Github,
  Globe,
  Linkedin,
  MapPin,
  Moon,
  Share2,
  Sun,
  Twitter,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

interface ProfileData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  location: string | null;
  jobTitle: string | null;
  company: string | null;
  yearsOfExperience: number | null;
  education: string[];
  skills: string[];
  languages: string[];
  interests: string[];
  githubUsername: string | null;
  twitterHandle: string | null;
  linkedInProfile: string | null;
  resumeUrl: string | null;
  portfolioUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;

      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/v1/profile/public/${userId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('Profile not found or not public');
          } else if (response.status === 401) {
            setError('You must be signed in to view this profile');
          } else {
            setError('Failed to load profile');
          }
          return;
        }

        const data = await response.json();
        setProfile(data.data);
        setIsOwner(data.meta?.isOwner || false);

        // Show consent dialog if required
        if (data.meta?.requiresConsent) {
          setShowConsentDialog(true);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: `${fullName}'s Profile`,
      text: `Check out ${fullName}'s profile on FairArena`,
      url: url,
    };

    try {
      // Try native Web Share API first
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.success('Profile shared successfully!');
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Profile link copied to clipboard!');
      }
    } catch (err) {
      // If user cancels share or any error occurs
      if ((err as Error).name !== 'AbortError') {
        console.error('Failed to share:', err);
        toast.error('Failed to share profile');
      }
    }
  };

  const handleConsentAccept = async () => {
    try {
      if (!profile) return;

      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/profile/${profile.id}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to record profile view');
      }

      setShowConsentDialog(false);
      toast.success('Thank you for your consent!');
    } catch (err) {
      console.error('Error recording profile view:', err);
      toast.error('Failed to record profile view');
    }
  };

  const handleConsentDecline = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Navigation Header Skeleton */}
        <div className="w-full border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="max-w-screen-2xl mx-auto">
              <div className="flex items-center justify-between h-16">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Hero Header Skeleton */}
        <div className="relative bg-linear-to-br from-primary/5 via-background to-muted/10 border-b">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="max-w-screen-2xl mx-auto">
              <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
                <Skeleton className="h-32 w-32 lg:h-48 lg:w-48 rounded-full" />
                <div className="flex-1 text-center lg:text-left space-y-6">
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-64 mx-auto lg:mx-0" />
                    <Skeleton className="h-6 w-48 mx-auto lg:mx-0" />
                    <Skeleton className="h-5 w-32 mx-auto lg:mx-0" />
                  </div>
                  <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-12 w-32" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="max-w-screen-2xl mx-auto">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-8">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-64 w-full rounded-lg" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              </div>
              <div className="space-y-8">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-56 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center text-destructive">
              {error || 'Profile Not Found'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              This profile is either not available or not public.
            </p>
            <Button onClick={() => navigate('/')} variant="outline" className="mr-2">
              Go Home
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Anonymous User';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="w-full border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-screen-2xl mx-auto">
            <div className="flex items-center justify-between h-16">
              {/* FairArena Logo */}
              <a
                href="https://fairarena.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg text-foreground">FairArena</span>
              </a>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="w-10 h-10 rounded-full hover:bg-accent transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <div className="relative bg-linear-to-br from-primary/5 via-background to-muted/10 border-b">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="max-w-screen-2xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
              {/* Avatar */}
              <div className="shrink-0">
                <Avatar className="h-32 w-32 lg:h-48 lg:w-48 border-4 border-background shadow-2xl ring-4 ring-primary/10 transition-transform hover:scale-105">
                  <AvatarImage
                    src={
                      profile.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`
                    }
                    alt={fullName}
                  />
                  <AvatarFallback className="text-4xl lg:text-6xl">{initials}</AvatarFallback>
                </Avatar>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center lg:text-left space-y-6">
                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
                    {fullName}
                  </h1>
                  {profile.jobTitle && (
                    <p className="text-lg sm:text-xl text-muted-foreground flex flex-wrap items-center justify-center lg:justify-start gap-2">
                      <Briefcase className="h-5 w-5 shrink-0" />
                      <span className="font-medium">{profile.jobTitle}</span>
                      {profile.company && (
                        <span className="text-foreground/60">at {profile.company}</span>
                      )}
                    </p>
                  )}
                  {profile.location && (
                    <p className="text-base sm:text-lg text-muted-foreground flex items-center justify-center lg:justify-start gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {profile.location}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                  {isOwner && (
                    <>
                      <Button
                        variant="default"
                        size="lg"
                        onClick={() => navigate('/dashboard/profile/edit')}
                        className="shadow-lg hover:shadow-xl transition-all"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => navigate('/dashboard/profile/views')}
                        className="shadow-lg hover:shadow-xl transition-all"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Profile Viewers
                      </Button>
                    </>
                  )}
                  <Button
                    variant={copied ? 'default' : 'outline'}
                    size="lg"
                    onClick={handleShare}
                    className="shadow-lg hover:shadow-xl transition-all"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    {copied ? 'Copied!' : 'Share'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="xl:col-span-2 space-y-8">
              {/* Bio */}
              {profile.bio && (
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-0 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-semibold">About</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-wrap">
                      {profile.bio}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Skills */}
              {profile.skills && profile.skills.length > 0 && (
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-0 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-semibold">Skills</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-3">
                      {profile.skills.map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="px-4 py-2 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Education */}
              {profile.education && profile.education.length > 0 && (
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-0 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-semibold">Education</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-3">
                      {profile.education.map((edu, index) => (
                        <li
                          key={index}
                          className="text-muted-foreground text-base flex items-start gap-3"
                        >
                          <span className="text-primary mt-1 text-lg">•</span>
                          <span className="leading-relaxed">{edu}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Languages & Interests */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profile.languages && profile.languages.length > 0 && (
                  <Card className="shadow-lg hover:shadow-xl transition-shadow border-0 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-semibold">Languages</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {profile.languages.map((lang) => (
                          <Badge
                            key={lang}
                            variant="outline"
                            className="px-3 py-1.5 hover:bg-accent transition-colors"
                          >
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {profile.interests && profile.interests.length > 0 && (
                  <Card className="shadow-lg hover:shadow-xl transition-shadow border-0 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-semibold">Interests</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {profile.interests.map((interest) => (
                          <Badge
                            key={interest}
                            variant="outline"
                            className="px-3 py-1.5 hover:bg-accent transition-colors"
                          >
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Experience */}
              {profile.yearsOfExperience !== null && (
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-0 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                      <Calendar className="h-5 w-5" />
                      Experience
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-center py-6">
                      <div className="text-4xl font-bold text-primary">
                        {profile.yearsOfExperience}
                      </div>
                      <p className="text-muted-foreground mt-2 text-sm">
                        {profile.yearsOfExperience === 1 ? 'Year' : 'Years'} of Experience
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Links */}
              {(profile.githubUsername ||
                profile.twitterHandle ||
                profile.linkedInProfile ||
                profile.portfolioUrl ||
                profile.resumeUrl) && (
                <Card className="shadow-lg hover:shadow-xl transition-shadow border-0 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold">Connect</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {profile.githubUsername && (
                        <a
                          href={`https://github.com/${profile.githubUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group"
                        >
                          <Github className="h-5 w-5 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">GitHub</span>
                        </a>
                      )}
                      {profile.twitterHandle && (
                        <a
                          href={`https://twitter.com/${profile.twitterHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group"
                        >
                          <Twitter className="h-5 w-5 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Twitter</span>
                        </a>
                      )}
                      {profile.linkedInProfile && (
                        <a
                          href={profile.linkedInProfile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group"
                        >
                          <Linkedin className="h-5 w-5 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">LinkedIn</span>
                        </a>
                      )}
                      {profile.portfolioUrl && (
                        <a
                          href={profile.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group"
                        >
                          <Globe className="h-5 w-5 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Portfolio</span>
                        </a>
                      )}
                      {profile.resumeUrl && (
                        <a
                          href={profile.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group"
                        >
                          <FileText className="h-5 w-5 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Resume</span>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Consent Dialog */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile View Tracking</DialogTitle>
            <DialogDescription>
              This profile collects information about visitors. By continuing, you allow the profile
              owner to see your name and email address.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              The following information will be shared with the profile owner:
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <span className="font-medium">Name:</span> {user?.fullName || 'Your full name'}
              </li>
              <li className="flex items-center gap-2">
                <span className="font-medium">Email:</span>{' '}
                {user?.primaryEmailAddress?.emailAddress || 'Your email address'}
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleConsentDecline}>
              Decline & Go Back
            </Button>
            <Button onClick={handleConsentAccept}>Accept & Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
