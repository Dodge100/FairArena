import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Edit, Eye, User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ProfileData {
  firstName: string;
  lastName: string;
  bio: string;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
  location: string;
  jobTitle: string;
  company: string;
  yearsOfExperience: number | string;
  experiences: string[];
  education: string[];
  skills: string[];
  languages: string[];
  interests: string[];
  certifications: string[];
  awards: string[];
  githubUsername: string;
  twitterHandle: string;
  linkedInProfile: string;
  resumeUrl: string;
  portfolioUrl: string;
  isPublic: boolean;
  requireAuth: boolean;
  trackViews: boolean;
}

export default function MyProfile() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.firstName?.[0]?.toUpperCase() || 'U';
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/v1/profile/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProfile(data.data);
        } else {
          toast.error('Failed to load profile data');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user, getToken]);

  const calculateProfileCompletion = () => {
    if (!profile) return { percentage: 0, completed: 0, total: 0 };

    const fields = [
      { name: 'firstName', value: profile.firstName },
      { name: 'lastName', value: profile.lastName },
      { name: 'bio', value: profile.bio },
      { name: 'gender', value: profile.gender },
      { name: 'dateOfBirth', value: profile.dateOfBirth },
      { name: 'phoneNumber', value: profile.phoneNumber },
      { name: 'location', value: profile.location },
      { name: 'jobTitle', value: profile.jobTitle },
      { name: 'company', value: profile.company },
      { name: 'yearsOfExperience', value: profile.yearsOfExperience },
      { name: 'experiences', value: profile.experiences?.length > 0 },
      { name: 'education', value: profile.education?.length > 0 },
      { name: 'skills', value: profile.skills?.length > 0 },
      { name: 'languages', value: profile.languages?.length > 0 },
      { name: 'interests', value: profile.interests?.length > 0 },
      { name: 'certifications', value: profile.certifications?.length > 0 },
      { name: 'awards', value: profile.awards?.length > 0 },
      { name: 'githubUsername', value: profile.githubUsername },
      { name: 'twitterHandle', value: profile.twitterHandle },
      { name: 'linkedInProfile', value: profile.linkedInProfile },
      { name: 'resumeUrl', value: profile.resumeUrl },
      { name: 'portfolioUrl', value: profile.portfolioUrl },
    ];

    const completed = fields.filter((field) => {
      if (typeof field.value === 'boolean') return field.value;
      return field.value && field.value.toString().trim() !== '';
    }).length;

    const percentage = Math.round((completed / fields.length) * 100);

    return { percentage, completed, total: fields.length };
  };

  const profileCompletion = calculateProfileCompletion();

  // Custom Circular Progress Component
  const CircularProgress = ({
    percentage,
    size = 180,
    strokeWidth = 20,
  }: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#10b981"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">{percentage}%</div>
            <div className="text-sm text-muted-foreground">Complete</div>
          </div>
        </div>
      </div>
    );
  };

  const profileActions = [
    {
      title: 'Edit Profile',
      description: 'Update your profile information, skills, and preferences',
      icon: Edit,
      action: () => navigate('/dashboard/profile/edit'),
      variant: 'default' as const,
    },
    {
      title: 'View Public Profile',
      description: 'See how your profile appears to other users',
      icon: Eye,
      action: () => navigate(`/profile/${user?.id}`),
      variant: 'outline' as const,
    },
    {
      title: 'Profile Viewers',
      description: 'Check who has viewed your profile recently',
      icon: Users,
      action: () => navigate('/dashboard/profile/views'),
      variant: 'outline' as const,
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user?.imageUrl} alt={user?.fullName || 'User'} />
              <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
            </Avatar>
          </div>
          <h1 className="text-3xl font-bold mb-2">My Profile</h1>
          <p className="text-muted-foreground">Manage your profile settings and view analytics</p>
        </div>

        {/* Profile Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profileActions.map((action, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <action.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-xl">{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button
                  onClick={action.action}
                  variant={action.variant}
                  size="lg"
                  className="w-full"
                >
                  {action.title}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Completion</span>
              </CardTitle>
              <CardDescription>Track your profile completeness and status</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading profile data...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Progress Chart */}
                  <div className="flex flex-col items-center">
                    <CircularProgress percentage={profileCompletion.percentage} />
                    <div className="mt-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        {profileCompletion.completed} of {profileCompletion.total} fields completed
                      </p>
                      <div className="flex justify-center items-center space-x-4 mt-2">
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span className="text-xs text-muted-foreground">Completed</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                          <span className="text-xs text-muted-foreground">Incomplete</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Cards */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">Profile Status</div>
                        <div className="text-sm text-muted-foreground">
                          {profileCompletion.percentage === 100 ? 'Complete' : 'In Progress'}
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-medium ${profileCompletion.percentage === 100
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                          }`}
                      >
                        {profileCompletion.percentage === 100 ? 'Complete' : 'Incomplete'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">Email Status</div>
                        <div className="text-sm text-muted-foreground">
                          {user?.primaryEmailAddress?.emailAddress || 'Not set'}
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Verified
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">Profile Visibility</div>
                        <div className="text-sm text-muted-foreground">
                          {profile?.isPublic ? 'Public' : 'Private'}
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-medium ${profile?.isPublic
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {profile?.isPublic ? 'Public' : 'Private'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">View Tracking</div>
                        <div className="text-sm text-muted-foreground">
                          {profile?.trackViews ? 'Enabled' : 'Disabled'}
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-medium ${profile?.trackViews
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {profile?.trackViews ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
