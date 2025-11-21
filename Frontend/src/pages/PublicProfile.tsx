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
  Mail,
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
  email: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  location: string | null;
  jobTitle: string | null;
  company: string | null;
  yearsOfExperience: number | null;
  experiences: string[];
  education: string[];
  skills: string[];
  languages: string[];
  interests: string[];
  certifications: string[];
  awards: string[];
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
      <div className="relative bg-linear-to-br from-primary/10 via-background to-muted/20 border-b overflow-hidden">
        {/* Modern Soft Background Pattern */}
        <div className="absolute inset-0 pointer-events-none">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1440 320"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <radialGradient
                id="bg1"
                cx="50%"
                cy="0%"
                r="100%"
                fx="50%"
                fy="0%"
                gradientTransform="rotate(45)"
              >
                <stop offset="0%" stopColor="#b5c800" stopOpacity="0.12" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
              <radialGradient
                id="bg2"
                cx="80%"
                cy="100%"
                r="100%"
                fx="80%"
                fy="100%"
                gradientTransform="rotate(-30)"
              >
                <stop offset="0%" stopColor="#00c6fb" stopOpacity="0.10" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="1440" height="320" fill="url(#bg1)" />
            <rect width="1440" height="320" fill="url(#bg2)" />
          </svg>
        </div>
        <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />

        <div className="w-full px-4 sm:px-6 lg:px-8 py-16 lg:py-20 relative">
          <div className="max-w-screen-2xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
              {/* Avatar */}
              <div className="shrink-0 relative">
                <div className="absolute -inset-1 bg-linear-to-r from-primary to-primary/60 rounded-full blur-lg opacity-30 animate-pulse" />
                <Avatar className="relative h-36 w-36 lg:h-52 lg:w-52 border-4 border-background shadow-2xl ring-4 ring-primary/20 transition-all duration-300 hover:scale-105 hover:shadow-primary/25">
                  <AvatarImage
                    src={
                      profile.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`
                    }
                    alt={fullName}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-5xl lg:text-7xl bg-linear-to-br from-primary/20 to-primary/10">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center lg:text-left space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent tracking-tight">
                      {fullName}
                    </h1>
                    {profile.jobTitle && (
                      <p className="text-xl sm:text-2xl text-muted-foreground flex flex-wrap items-center justify-center lg:justify-start gap-3 font-medium">
                        <Briefcase className="h-6 w-6 shrink-0 text-primary" />
                        <span>{profile.jobTitle}</span>
                        {profile.company && (
                          <>
                            <span className="text-muted-foreground/60">at</span>
                            <span className="text-foreground font-semibold">{profile.company}</span>
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  {profile.location && (
                    <p className="text-lg sm:text-xl text-muted-foreground flex items-center justify-center lg:justify-start gap-3">
                      <MapPin className="h-5 w-5 shrink-0 text-primary" />
                      <span className="font-medium">{profile.location}</span>
                    </p>
                  )}

                  {/* Quick Stats */}
                  <div className="flex flex-wrap justify-center lg:justify-start gap-6 pt-2">
                    {profile.yearsOfExperience !== null && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {profile.yearsOfExperience}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {profile.yearsOfExperience === 1 ? 'Year' : 'Years'} Exp.
                        </div>
                      </div>
                    )}
                    {profile.skills && profile.skills.length > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {profile.skills.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Skills</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2">
                  {isOwner && (
                    <>
                      <Button
                        variant="default"
                        size="lg"
                        onClick={() => navigate('/dashboard/profile/edit')}
                        className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-linear-to-r from-primary to-primary/90"
                      >
                        <Edit className="h-5 w-5 mr-2" />
                        Edit Profile
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => navigate('/dashboard/profile/views')}
                        className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-primary/20 hover:border-primary/40"
                      >
                        <FileText className="h-5 w-5 mr-2" />
                        View Analytics
                      </Button>
                    </>
                  )}
                  <Button
                    variant={copied ? 'default' : 'outline'}
                    size="lg"
                    onClick={handleShare}
                    className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-primary/20 hover:border-primary/40"
                  >
                    <Share2 className="h-5 w-5 mr-2" />
                    {copied ? 'Copied!' : 'Share Profile'}
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
                <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 transition-transform" />
                      About
                    </CardTitle>
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
                <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 transition-transform" />
                      Skills
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-3">
                      {profile.skills.map((skill, index) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="px-4 py-2 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-all duration-200 hover:scale-105 cursor-default"
                          style={{ animationDelay: `${index * 50}ms` }}
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
                <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 transition-transform" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-3">
                      {profile.education.map((edu, index) => (
                        <li
                          key={index}
                          className="text-muted-foreground text-base flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <span className="text-primary mt-1 text-lg">•</span>
                          <span className="leading-relaxed">{edu}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Experiences */}
              {profile.experiences && profile.experiences.length > 0 && (
                <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 transition-transform" />
                      Professional Experience
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-3">
                      {profile.experiences.map((exp, index) => (
                        <li
                          key={index}
                          className="text-muted-foreground text-base flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <span className="text-primary mt-1 text-lg">•</span>
                          <span className="leading-relaxed">{exp}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Certifications */}
              {profile.certifications && profile.certifications.length > 0 && (
                <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 transition-transform" />
                      Certifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-3">
                      {profile.certifications.map((cert, index) => (
                        <li
                          key={index}
                          className="text-muted-foreground text-base flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <span className="text-primary mt-1 text-lg">•</span>
                          <span className="leading-relaxed">{cert}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Awards */}
              {profile.awards && profile.awards.length > 0 && (
                <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 transition-transform" />
                      Awards & Honors
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-3">
                      {profile.awards.map((award, index) => (
                        <li
                          key={index}
                          className="text-muted-foreground text-base flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <span className="text-primary mt-1 text-lg">•</span>
                          <span className="leading-relaxed">{award}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Languages & Interests */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profile.languages && profile.languages.length > 0 && (
                  <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-semibold flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 transition-transform" />
                        Languages
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {profile.languages.map((lang) => (
                          <Badge
                            key={lang}
                            variant="outline"
                            className="px-3 py-1.5 hover:bg-accent hover:border-primary/50 transition-all duration-200 hover:scale-105 cursor-default"
                          >
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {profile.interests && profile.interests.length > 0 && (
                  <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-semibold flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 transition-transform" />
                        Interests
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {profile.interests.map((interest) => (
                          <Badge
                            key={interest}
                            variant="outline"
                            className="px-3 py-1.5 hover:bg-accent hover:border-primary/50 transition-all duration-200 hover:scale-105 cursor-default"
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
                <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                      <Calendar className="h-5 w-5 text-primary" />
                      Experience
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-center py-6">
                      <div className="text-5xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform">
                        {profile.yearsOfExperience}
                      </div>
                      <p className="text-muted-foreground text-sm font-medium">
                        {profile.yearsOfExperience === 1 ? 'Year' : 'Years'} of Experience
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Links */}
              {(profile.email ||
                profile.githubUsername ||
                profile.twitterHandle ||
                profile.linkedInProfile ||
                profile.portfolioUrl ||
                profile.resumeUrl) && (
                <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm hover:scale-[1.02] group">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 transition-transform" />
                      Connect
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {profile.email && (
                        <a
                          href={`mailto:${profile.email}`}
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group/link hover:scale-[1.02] hover:shadow-md"
                        >
                          <Mail className="h-5 w-5 group-hover/link:scale-110 transition-transform text-primary" />
                          <div className="flex-1">
                            <span className="font-medium block">Email</span>
                            <span className="text-sm text-muted-foreground">{profile.email}</span>
                          </div>
                        </a>
                      )}
                      {profile.githubUsername && (
                        <a
                          href={`https://github.com/${profile.githubUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group/link hover:scale-[1.02] hover:shadow-md"
                        >
                          <Github className="h-5 w-5 group-hover/link:scale-110 transition-transform text-primary" />
                          <span className="font-medium">GitHub</span>
                        </a>
                      )}
                      {profile.twitterHandle && (
                        <a
                          href={`https://twitter.com/${profile.twitterHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group/link hover:scale-[1.02] hover:shadow-md"
                        >
                          <Twitter className="h-5 w-5 group-hover/link:scale-110 transition-transform text-primary" />
                          <span className="font-medium">Twitter</span>
                        </a>
                      )}
                      {profile.linkedInProfile && (
                        <a
                          href={profile.linkedInProfile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group/link hover:scale-[1.02] hover:shadow-md"
                        >
                          <Linkedin className="h-5 w-5 group-hover/link:scale-110 transition-transform text-primary" />
                          <span className="font-medium">LinkedIn</span>
                        </a>
                      )}
                      {profile.portfolioUrl && (
                        <a
                          href={profile.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group/link hover:scale-[1.02] hover:shadow-md"
                        >
                          <Globe className="h-5 w-5 group-hover/link:scale-110 transition-transform text-primary" />
                          <span className="font-medium">Portfolio</span>
                        </a>
                      )}
                      {profile.resumeUrl && (
                        <a
                          href={profile.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-all group/link hover:scale-[1.02] hover:shadow-md"
                        >
                          <FileText className="h-5 w-5 group-hover/link:scale-110 transition-transform text-primary" />
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
