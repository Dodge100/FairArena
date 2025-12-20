import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Settings, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../lib/apiClient';
import { CreateTeamModal } from './CreateTeamModal';
import { TeamInviteModal } from './TeamInviteModal';

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

interface TeamManagementModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationSlug: string;
}

export function TeamManagementModal({
    open,
    onOpenChange,
    organizationSlug,
}: TeamManagementModalProps) {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

    const fetchTeams = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/teams`
            );

            if (response.ok) {
                const data = await response.json();
                setTeams(data.teams || []);
            } else {
                toast.error('Failed to load teams');
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
            toast.error('Failed to load teams');
        } finally {
            setLoading(false);
        }
    }, [organizationSlug]);

    useEffect(() => {
        if (open) {
            fetchTeams();
        }
    }, [open, fetchTeams]);

    const handleDeleteTeam = async (team: Team) => {
        if (
            !confirm(
                `Are you sure you want to delete "${team.name}"? This action cannot be undone.`
            )
        ) {
            return;
        }

        try {
            const response = await apiFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/team/${team.slug}`,
                {
                    method: 'DELETE',
                }
            );

            if (response.ok) {
                toast.success(`Team "${team.name}" is being deleted`);
                // Refresh the teams list after a short delay
                setTimeout(() => fetchTeams(), 2000);
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to delete team');
            }
        } catch (error) {
            console.error('Error deleting team:', error);
            toast.error('Failed to delete team');
        }
    };

    const handleInviteToTeam = (team: Team) => {
        setSelectedTeam(team);
        setInviteModalOpen(true);
    };

    const getVisibilityBadge = (visibility: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
            PUBLIC: 'default',
            INTERNAL: 'secondary',
            PRIVATE: 'destructive',
        };
        return (
            <Badge variant={variants[visibility] || 'default'}>
                {visibility}
            </Badge>
        );
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle>Team Management</DialogTitle>
                                <DialogDescription>
                                    Manage teams in your organization
                                </DialogDescription>
                            </div>
                            <Button
                                onClick={() => setCreateModalOpen(true)}
                                size="sm"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Team
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="overflow-y-auto pr-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : teams.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Create your first team to get started
                                </p>
                                <Button onClick={() => setCreateModalOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Team
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {teams.map((team) => (
                                    <div
                                        key={team.id}
                                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3 flex-1">
                                                {team.logoUrl && (
                                                    <img
                                                        src={team.logoUrl}
                                                        alt={team.name}
                                                        className="w-12 h-12 rounded-lg object-cover"
                                                    />
                                                )}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold">
                                                            {team.name}
                                                        </h3>
                                                        {getVisibilityBadge(team.visibility)}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground mb-2">
                                                        /{team.slug}
                                                    </p>
                                                    {team.description && (
                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            {team.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        <span>
                                                            <Users className="h-3 w-3 inline mr-1" />
                                                            {team.memberCount} members
                                                        </span>
                                                        <span>
                                                            {team.projectCount} projects
                                                        </span>
                                                        <span>
                                                            Created{' '}
                                                            {new Date(
                                                                team.createdAt
                                                            ).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleInviteToTeam(team)}
                                                >
                                                    <Users className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        window.location.href = `/organization/${organizationSlug}/team/${team.slug}`;
                                                    }}
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteTeam(team)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <CreateTeamModal
                open={createModalOpen}
                onOpenChange={setCreateModalOpen}
                organizationSlug={organizationSlug}
                onTeamCreated={fetchTeams}
            />

            {selectedTeam && (
                <TeamInviteModal
                    open={inviteModalOpen}
                    onOpenChange={setInviteModalOpen}
                    organizationSlug={organizationSlug}
                    onInviteSent={fetchTeams}
                    onCreateTeam={() => setCreateModalOpen(true)}
                />
            )}
        </>
    );
}
