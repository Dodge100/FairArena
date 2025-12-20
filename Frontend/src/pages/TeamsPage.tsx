import { CreateTeamModal } from '@/components/CreateTeamModal';
import { TeamManagementModal } from '@/components/TeamManagementModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/apiClient';
import { Loader2, Plus, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Team {
    id: string;
    name: string;
    slug: string;
    visibility: string;
    description?: string;
    logoUrl?: string;
    memberCount: number;
    projectCount: number;
    createdAt: string;
}

interface OrganizationTeam {
    organizationSlug: string;
    organizationName: string;
    teams: Team[];
}

interface Organization {
    slug: string;
    name: string;
}

export default function TeamsPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [organizationTeams, setOrganizationTeams] = useState<OrganizationTeam[]>([]);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [managementModalOpen, setManagementModalOpen] = useState(false);
    const [selectedOrgSlug, setSelectedOrgSlug] = useState('');

    const fetchAllTeams = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch user's organizations first
            const orgsResponse = await apiFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/organization`
            );

            if (!orgsResponse.ok) {
                toast.error('Failed to load organizations');
                return;
            }

            const orgsData = await orgsResponse.json();
            const organizations: Organization[] = orgsData.organizations || [];

            // Fetch teams for each organization
            const teamsPromises = organizations.map(async (org: Organization) => {
                try {
                    const teamsResponse = await apiFetch(
                        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${org.slug}/teams`
                    );

                    if (teamsResponse.ok) {
                        const teamsData = await teamsResponse.json();
                        return {
                            organizationSlug: org.slug,
                            organizationName: org.name,
                            teams: teamsData.teams || [],
                        };
                    }
                    return {
                        organizationSlug: org.slug,
                        organizationName: org.name,
                        teams: [],
                    };
                } catch (error) {
                    console.error(`Error fetching teams for ${org.slug}:`, error);
                    return {
                        organizationSlug: org.slug,
                        organizationName: org.name,
                        teams: [],
                    };
                }
            });

            const allTeams = await Promise.all(teamsPromises);
            setOrganizationTeams(allTeams);
        } catch (error) {
            console.error('Error fetching teams:', error);
            toast.error('Failed to load teams');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllTeams();
    }, [fetchAllTeams]);

    const filteredTeams = organizationTeams
        .map((orgTeam) => ({
            ...orgTeam,
            teams: orgTeam.teams.filter(
                (team) =>
                    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    team.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    team.description?.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        }))
        .filter((orgTeam) => orgTeam.teams.length > 0);

    const totalTeams = organizationTeams.reduce((sum, org) => sum + org.teams.length, 0);

    const getVisibilityBadge = (visibility: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
            PUBLIC: 'default',
            INTERNAL: 'secondary',
            PRIVATE: 'destructive',
        };
        return (
            <Badge variant={variants[visibility] || 'default'} className="text-xs">
                {visibility}
            </Badge>
        );
    };

    const handleCreateTeam = (orgSlug: string) => {
        setSelectedOrgSlug(orgSlug);
        setCreateModalOpen(true);
    };

    const handleManageTeam = (orgSlug: string) => {
        setSelectedOrgSlug(orgSlug);
        setManagementModalOpen(true);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Users className="h-8 w-8" />
                            Teams
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Manage all your teams across organizations
                        </p>
                    </div>
                    {totalTeams > 0 && (
                        <div className="text-sm text-muted-foreground">
                            {totalTeams} {totalTeams === 1 ? 'team' : 'teams'} total
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search teams..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : totalTeams === 0 ? (
                /* Empty State */
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No teams yet</h3>
                    <p className="text-muted-foreground mb-6">
                        Create your first team to start collaborating
                    </p>
                </div>
            ) : (
                /* Teams List */
                <div className="space-y-8">
                    {filteredTeams.map((orgTeam) => (
                        <div key={orgTeam.organizationSlug} className="space-y-4">
                            {/* Organization Header */}
                            <div className="flex items-center justify-between pb-2 border-b">
                                <h2 className="text-xl font-semibold">{orgTeam.organizationName}</h2>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleManageTeam(orgTeam.organizationSlug)}
                                    >
                                        <Users className="h-4 w-4 mr-2" />
                                        Manage
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleCreateTeam(orgTeam.organizationSlug)}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Team
                                    </Button>
                                </div>
                            </div>

                            {/* Teams Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {orgTeam.teams.map((team) => (
                                    <div
                                        key={team.id}
                                        className="border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer group"
                                        onClick={() =>
                                            navigate(
                                                `/organization/${orgTeam.organizationSlug}/team/${team.slug}`
                                            )
                                        }
                                    >
                                        <div className="flex items-start gap-3 mb-3">
                                            {team.logoUrl ? (
                                                <img
                                                    src={team.logoUrl}
                                                    alt={team.name}
                                                    className="w-12 h-12 rounded-lg object-cover"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <Users className="h-6 w-6 text-primary" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                                                        {team.name}
                                                    </h3>
                                                    {getVisibilityBadge(team.visibility)}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    /{team.slug}
                                                </p>
                                            </div>
                                        </div>

                                        {team.description && (
                                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                                {team.description}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t">
                                            <span className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {team.memberCount}
                                            </span>
                                            <span>{team.projectCount} projects</span>
                                            <span className="ml-auto">
                                                {new Date(team.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {searchQuery && filteredTeams.length === 0 && (
                        <div className="text-center py-12">
                            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No teams found</h3>
                            <p className="text-muted-foreground">
                                Try adjusting your search terms
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {selectedOrgSlug && (
                <>
                    <CreateTeamModal
                        open={createModalOpen}
                        onOpenChange={setCreateModalOpen}
                        organizationSlug={selectedOrgSlug}
                        onTeamCreated={fetchAllTeams}
                    />
                    <TeamManagementModal
                        open={managementModalOpen}
                        onOpenChange={setManagementModalOpen}
                        organizationSlug={selectedOrgSlug}
                    />
                </>
            )}
        </div>
    );
}
