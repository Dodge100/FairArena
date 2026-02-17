import {
  Building2,
  Calendar,
  Globe,
  Lock,
  MapPin,
  Plus,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { useOrganization } from '../contexts/OrganizationContext';
import { CreateOrganizationModal } from './CreateOrganizationModal';
import { OrganizationDetailsModal } from './OrganizationDetailsModal';

interface OrganizationPermissions {
  organization: {
    view: boolean;
    edit: boolean;
    delete: boolean;
    manageSettings: boolean;
    manageBilling: boolean;
    manageSecurity: boolean;
  };
  teams: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    manageMembers: boolean;
  };
  members: {
    view: boolean;
    invite: boolean;
    remove: boolean;
    manageRoles: boolean;
  };
  projects: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    manageSettings: boolean;
  };
  roles: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    assign: boolean;
  };
  audit: {
    view: boolean;
  };
}

type Organization = {
  id: string;
  name: string;
  slug: string;
  isPublic: boolean;
  memberCount: number;
  teamCount: number;
  userRole: {
    id: string;
    name: string;
    permissions: OrganizationPermissions;
  };
  timezone?: string;
  createdAt: string;
  joinEnabled: boolean;
};

interface OrganizationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OrganizationsModal = ({ open, onOpenChange }: OrganizationsModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedOrgForDetails, setSelectedOrgForDetails] = useState<Organization | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const { organizations, loading, refreshOrganizations } = useOrganization();

  // Define the raw organization type as returned from the context/provider
  type RawOrganization = Omit<Organization, 'userRole'> & {
    userRole: {
      id: string;
      name: string;
      permissions: Record<string, unknown>;
    };
  };

  // Map organizations to match the local Organization type
  const mappedOrganizations = useMemo<Organization[]>(() => {
    return (organizations as RawOrganization[]).map((org) => ({
      ...org,
      userRole: {
        ...org.userRole,
        permissions: org.userRole.permissions as unknown as OrganizationPermissions,
      },
    }));
  }, [organizations]);

  const filteredOrganizations = useMemo(() => {
    return mappedOrganizations.filter(
      (org) =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.slug.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [mappedOrganizations, searchQuery]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>My Organizations</DialogTitle>
            <DialogDescription>Manage and explore your organizations</DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-center">
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Organization
              </Button>
            </div>

            {organizations.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 max-w-sm"
                />
              </div>
            )}

            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <Skeleton className="h-6 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <div key={j} className="flex justify-between">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-8" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredOrganizations.length === 0 && organizations.length > 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No organizations found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your search query or create a new organization.
                  </p>
                  <Button onClick={() => setCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Organization
                  </Button>
                </CardContent>
              </Card>
            ) : filteredOrganizations.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Get started by creating your first organization to collaborate with your team.
                  </p>
                  <Button onClick={() => setCreateModalOpen(true)} size="lg">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Organization
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredOrganizations.map((org) => (
                  <Card
                    key={org.id}
                    className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg truncate">{org.name}</CardTitle>
                            <CardDescription className="truncate">@{org.slug}</CardDescription>
                          </div>
                        </div>
                        <Badge
                          variant={org.isPublic ? 'default' : 'secondary'}
                          className="shrink-0 ml-2"
                        >
                          {org.isPublic ? (
                            <>
                              <Globe className="mr-1 h-3 w-3" />
                              Public
                            </>
                          ) : (
                            <>
                              <Lock className="mr-1 h-3 w-3" />
                              Private
                            </>
                          )}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>Members</span>
                          </div>
                          <span className="font-medium">{org.memberCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <UserCheck className="h-4 w-4" />
                            <span>Teams</span>
                          </div>
                          <span className="font-medium">{org.teamCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Your Role</span>
                          <Badge variant="outline" className="text-xs">
                            {org.userRole.name}
                          </Badge>
                        </div>
                        {org.timezone && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>Timezone</span>
                            </div>
                            <span className="font-medium">{org.timezone}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Created</span>
                          </div>
                          <span className="font-medium">{formatDate(org.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedOrgForDetails(org);
                            setDetailsModalOpen(true);
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <CreateOrganizationModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <OrganizationDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        organization={selectedOrgForDetails}
        onOrganizationUpdate={refreshOrganizations}
      />
    </>
  );
};
