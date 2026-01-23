import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Building2, Globe, Lock, Save, Settings, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { apiRequest } from '../lib/apiClient';
import { SSOConfigSettings } from './organization/SSOConfigSettings';

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
    permissions: OrganizationPermissions;
  };
}

interface OrganizationSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization | null;
  onOrganizationUpdate?: () => void;
}

export const OrganizationSettingsModal = ({
  open,
  onOpenChange,
  organization,
  onOrganizationUpdate,
}: OrganizationSettingsModalProps) => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    isPublic: false,
    joinEnabled: false,
  });

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        isPublic: organization.isPublic,
        joinEnabled: organization.joinEnabled,
      });
    }
  }, [organization]);

  const saveSettingsMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/${organization?.slug}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast.success('Organization settings updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      onOrganizationUpdate?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error('Failed to update organization settings');
    },
  });

  const deleteOrganizationMutation = useMutation({
    mutationFn: () => apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/${organization?.slug}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      toast.success('Organization deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      onOrganizationUpdate?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error('Failed to delete organization');
    },
  });

  const handleSave = () => {
    if (!organization) return;
    saveSettingsMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (!organization) return;
    deleteOrganizationMutation.mutate();
  };

  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Organization Settings
          </DialogTitle>
          <DialogDescription>
            Manage settings for {organization.name}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto space-y-6">
          {/* Organization Info */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{organization.name}</h3>
              <p className="text-sm text-muted-foreground">@{organization.slug}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{organization.memberCount}</p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{organization.teamCount}</p>
                <p className="text-xs text-muted-foreground">Teams</p>
              </div>
            </div>
          </div>

          {/* Settings Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter organization name"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isPublic">Public Organization</Label>
                <p className="text-sm text-muted-foreground">
                  {formData.isPublic ? (
                    <>
                      <Globe className="inline h-3 w-3 mr-1" />
                      Visible to everyone
                    </>
                  ) : (
                    <>
                      <Lock className="inline h-3 w-3 mr-1" />
                      Private organization
                    </>
                  )}
                </p>
              </div>
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="joinEnabled">Allow Members to Join</Label>
                <p className="text-sm text-muted-foreground">
                  Let users request to join this organization
                </p>
              </div>
              <Switch
                id="joinEnabled"
                checked={formData.joinEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, joinEnabled: checked })}
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4">Enterprise SSO</h4>
            <SSOConfigSettings organizationId={organization.id} />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Organization
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Delete Organization
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{organization.name}"? This action cannot be undone
                    and will remove all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete Organization
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button onClick={handleSave} disabled={saveSettingsMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
