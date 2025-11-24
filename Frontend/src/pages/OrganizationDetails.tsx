import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@clerk/clerk-react';
import {
    ArrowLeft,
    Building2,
    Calendar,
    Crown,
    Globe,
    Lock,
    MapPin,
    Settings,
    Shield,
    User,
    UserCheck,
    Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

interface Organization {
    id: string;
    name: string;
    slug: string;
    joinEnabled: boolean;
    isPublic: boolean;
    timezone?: string;
    createdAt: string;
    memberCount: number;
    teamCount: number;
    userRole: {
        id: string;
        name: string;
        permissions: Record<string, unknown>;
    };
}

interface Team {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    createdAt: string;
}

interface Member {
    id: string;
    name: string;
    email: string;
    role: {
        id: string;
        name: string;
    };
    joinedAt: string;
}

const OrganizationDetails = () => {
    const navigate = useNavigate();
    const { slug } = useParams<{ slug: string }>();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const { getToken } = useAuth();

    useEffect(() => {
        const fetchOrganizationDetails = async () => {
            if (!slug) return;

            try {
                const token = await getToken();
                const [orgResponse, teamsResponse, membersResponse] = await Promise.all([
                    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/${slug}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/${slug}/teams`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/${slug}/members`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);

                if (orgResponse.ok) {
                    const orgData = await orgResponse.json();
                    setOrganization(orgData.organization);
                }

                if (teamsResponse.ok) {
                    const teamsData = await teamsResponse.json();
                    setTeams(teamsData.teams || []);
                }

                if (membersResponse.ok) {
                    const membersData = await membersResponse.json();
                    setMembers(membersData.members || []);
                }
            } catch (error) {
                toast.error('Failed to load organization details');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrganizationDetails();
    }, [slug, getToken]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getRoleIcon = (roleName: string) => {
        switch (roleName.toLowerCase()) {
            case 'owner':
                return <Crown className="h-4 w-4 text-yellow-500" />;
            case 'admin':
                return <Shield className="h-4 w-4 text-blue-500" />;
            default:
                return <User className="h-4 w-4 text-gray-500" />;
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto py-8 px-4 max-w-7xl">
                <div className="flex items-center gap-4 mb-8">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="grid gap-6 md:grid-cols-3 mb-8">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-6">
                                <Skeleton className="h-6 w-24 mb-2" />
                                <Skeleton className="h-8 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (!organization) {
        return (
            <div className="container mx-auto py-8 px-4 max-w-7xl">
                <Card className="text-center py-12">
                    <CardContent>
                        <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Organization not found</h3>
                        <p className="text-muted-foreground mb-6">
                            The organization you're looking for doesn't exist or you don't have access to it.
                        </p>
                        <Button onClick={() => navigate('/dashboard/organization')}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Organizations
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/dashboard/organization')}
                        className="shrink-0"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-lg">
                            <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
                            <p className="text-muted-foreground">@{organization.slug}</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => navigate(`/dashboard/organization/${organization.slug}/settings`)}
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-3 mb-8">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Members</p>
                                <p className="text-2xl font-bold">{organization.memberCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                                <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Teams</p>
                                <p className="text-2xl font-bold">{organization.teamCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                                {organization.isPublic ? (
                                    <Globe className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                ) : (
                                    <Lock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Visibility</p>
                                <p className="text-lg font-semibold">
                                    {organization.isPublic ? 'Public' : 'Private'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Organization Info */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Organization Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Created</p>
                                <p className="text-sm text-muted-foreground">{formatDate(organization.createdAt)}</p>
                            </div>
                        </div>
                        {organization.timezone && (
                            <div className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Timezone</p>
                                    <p className="text-sm text-muted-foreground">{organization.timezone}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <Badge variant={organization.joinEnabled ? 'default' : 'secondary'}>
                                {organization.joinEnabled ? 'Join Requests Enabled' : 'Join Requests Disabled'}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant="outline">
                                Your Role: {organization.userRole.name}
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs for Teams and Members */}
            <Tabs defaultValue="teams" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="teams">Teams ({teams.length})</TabsTrigger>
                    <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="teams" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Teams</CardTitle>
                            <CardDescription>
                                Manage teams within this organization
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {teams.length === 0 ? (
                                <div className="text-center py-8">
                                    <UserCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
                                    <p className="text-muted-foreground">
                                        Create your first team to organize your members.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {teams.map((team) => (
                                        <Card key={team.id} className="hover:shadow-md transition-shadow">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-lg">{team.name}</CardTitle>
                                                {team.description && (
                                                    <CardDescription>{team.description}</CardDescription>
                                                )}
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground">Members</span>
                                                    <span className="font-medium">{team.memberCount}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm mt-2">
                                                    <span className="text-muted-foreground">Created</span>
                                                    <span className="font-medium">{formatDate(team.createdAt)}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="members" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Members</CardTitle>
                            <CardDescription>
                                People who are part of this organization
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {members.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">No members yet</h3>
                                    <p className="text-muted-foreground">
                                        Invite members to join your organization.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {members.map((member) => (
                                        <div
                                            key={member.id}
                                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                                    <span className="text-sm font-medium">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium">{member.name}</p>
                                                    <p className="text-sm text-muted-foreground">{member.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2">
                                                    {getRoleIcon(member.role.name)}
                                                    <Badge variant="outline">{member.role.name}</Badge>
                                                </div>
                                                <span className="text-sm text-muted-foreground">
                                                    Joined {formatDate(member.joinedAt)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default OrganizationDetails;
