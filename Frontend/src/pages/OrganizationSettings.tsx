import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@clerk/clerk-react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Globe,
  Lock,
  Save,
  Settings,
  Trash2,
  Users,
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

const OrganizationSettings = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    isPublic: false,
    joinEnabled: false,
  });
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!slug) return;

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/${slug}`,
          {
            headers: {
              Authorization: `Bearer ${await getToken()}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const org = data.organization;
          setOrganization(org);
          setFormData({
            name: org.name,
            isPublic: org.isPublic,
            joinEnabled: org.joinEnabled,
          });
        } else {
          toast.error('Failed to load organization');
        }
      } catch (error) {
        toast.error('An error occurred while loading organization');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [slug, getToken]);

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/${organization.slug}/settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify(formData),
        },
      );

      if (response.ok) {
        toast.success('Organization settings updated successfully!');
        // Update local state
        setOrganization((prev) => (prev ? { ...prev, ...formData } : null));
      } else {
        toast.error('Failed to update organization settings');
      }
    } catch (error) {
      toast.error('An error occurred while updating settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!organization) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/${organization.slug}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        },
      );

      if (response.ok) {
        toast.success('Organization deleted successfully!');
        navigate('/dashboard/organization');
      } else {
        toast.error('Failed to delete organization');
      }
    } catch (error) {
      toast.error('An error occurred while deleting organization');
      console.error(error);
    }
  };

  const hasUnsavedChanges = () => {
    if (!organization) return false;
    return (
      formData.name !== organization.name ||
      formData.isPublic !== organization.isPublic ||
      formData.joinEnabled !== organization.joinEnabled
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
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

  const canEdit = Boolean(organization.userRole.permissions?.canEditSettings);
  const canDelete = Boolean(organization.userRole.permissions?.canDeleteOrganization);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/dashboard/organization/${organization.slug}`)}
            className="shrink-0"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organization
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
              <p className="text-muted-foreground">Manage {organization.name} settings</p>
            </div>
          </div>
        </div>
        {hasUnsavedChanges() && (
          <Button onClick={handleSave} disabled={saving || !canEdit}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {!canEdit && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                You don't have permission to edit this organization's settings.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Basic information about your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter organization name"
                disabled={!canEdit}
              />
              <p className="text-sm text-muted-foreground">
                This is the display name for your organization.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isPublic">Public Organization</Label>
                <p className="text-sm text-muted-foreground">
                  Public organizations are visible to everyone and can be discovered.
                </p>
              </div>
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isPublic: checked }))
                }
                disabled={!canEdit}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="joinEnabled">Allow Join Requests</Label>
                <p className="text-sm text-muted-foreground">
                  Allow users to request to join this organization.
                </p>
              </div>
              <Switch
                id="joinEnabled"
                checked={formData.joinEnabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, joinEnabled: checked }))
                }
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        {/* Organization Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Overview</CardTitle>
            <CardDescription>Current statistics and information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Members</p>
                  <p className="text-lg font-semibold">{organization.memberCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Teams</p>
                  <p className="text-lg font-semibold">{organization.teamCount}</p>
                </div>
              </div>
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
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        {canDelete && (
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
              <CardDescription>Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-red-600 dark:text-red-400">
                    Delete Organization
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this organization and all associated data. This action cannot
                    be undone.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the organization
                        "{organization.name}" and remove all associated data including teams,
                        members, and settings.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete Organization
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OrganizationSettings;
