import { useAuth } from '@clerk/clerk-react';
import {
  Building2,
  Calendar,
  Globe,
  Lock,
  MapPin,
  Plus,
  Search,
  UserCheck,
  Users
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';

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

const Organizations = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { getToken } = useAuth();

  const filteredOrganizations = useMemo(() => {
    return organizations.filter(org =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [organizations, searchQuery]);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/organization`, {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations);
        } else {
          toast.error('Failed to load organizations');
        }
      } catch (error) {
        toast.error('An error occurred while loading organizations');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [getToken]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
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
                <div className="space-y-3 mb-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Organizations</h1>
          <p className="text-muted-foreground mt-1">
            Manage and explore your organizations
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/organization/create')} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Create Organization
        </Button>
      </div>

      {organizations.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 max-w-sm"
          />
        </div>
      )}

      {filteredOrganizations.length === 0 && organizations.length > 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No organizations found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search query or create a new organization.
            </p>
            <Button onClick={() => navigate('/dashboard/organization/create')}>
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
            <Button onClick={() => navigate('/dashboard/organization/create')} size="lg">
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
              className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer group"
              onClick={() => navigate(`/dashboard/organization/${org.slug}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
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
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/dashboard/organization/${org.slug}`);
                    }}
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/dashboard/organization/${org.slug}/settings`);
                    }}
                  >
                    Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Organizations;
