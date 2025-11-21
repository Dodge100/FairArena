import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@clerk/clerk-react';
import { Edit, Eye, User, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MyProfile() {
    const { user } = useUser();
    const navigate = useNavigate();

    const getInitials = () => {
        if (user?.firstName && user?.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        }
        return user?.firstName?.[0]?.toUpperCase() || 'U';
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
                            <AvatarFallback className="text-2xl">
                                {getInitials()}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <h1 className="text-3xl font-bold mb-2">My Profile</h1>
                    <p className="text-muted-foreground">
                        Manage your profile settings and view analytics
                    </p>
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
                                <span>Profile Overview</span>
                            </CardTitle>
                            <CardDescription>
                                Quick summary of your profile status
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="text-center p-4 border rounded-lg">
                                    <div className="text-2xl font-bold text-primary">
                                        {user?.firstName && user?.lastName ? 'Complete' : 'Incomplete'}
                                    </div>
                                    <div className="text-sm text-muted-foreground">Profile Status</div>
                                </div>
                                <div className="text-center p-4 border rounded-lg">
                                    <div className="text-2xl font-bold text-primary">
                                        {user?.primaryEmailAddress ? 'Verified' : 'Unverified'}
                                    </div>
                                    <div className="text-sm text-muted-foreground">Email Status</div>
                                </div>
                                <div className="text-center p-4 border rounded-lg">
                                    <div className="text-2xl font-bold text-primary">
                                        Public
                                    </div>
                                    <div className="text-sm text-muted-foreground">Profile Visibility</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
