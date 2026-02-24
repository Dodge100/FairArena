/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { Building2, Globe, Lock, Mail, Settings, Shield, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { OrganizationAuditLogsModal } from './OrganizationAuditLogsModal';
import { OrganizationSettingsModal } from './OrganizationSettingsModal';
import { TeamInviteModal } from './TeamInviteModal';
import { TeamManagementModal } from './TeamManagementModal';

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

interface OrganizationDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization | null;
  onOrganizationUpdate?: () => void;
}

export const OrganizationDetailsModal = ({
  open,
  onOpenChange,
  organization,
  onOrganizationUpdate,
}: OrganizationDetailsModalProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamManagementOpen, setTeamManagementOpen] = useState(false);

  if (!organization) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {organization.name}
            </DialogTitle>
            <DialogDescription>Organization details and information</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-6 py-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Basic Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Name</span>
                      <span className="text-sm font-medium">{organization.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Slug</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {organization.slug}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Visibility</span>
                      <div className="flex items-center gap-1">
                        {organization.isPublic ? (
                          <Globe className="h-4 w-4 text-green-600" />
                        ) : (
                          <Lock className="h-4 w-4 text-orange-600" />
                        )}
                        <span className="text-sm">
                          {organization.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Join Requests</span>
                      <div className="flex items-center gap-1">
                        <UserCheck
                          className={`h-4 w-4 ${organization.joinEnabled ? 'text-green-600' : 'text-red-600'}`}
                        />
                        <span className="text-sm">
                          {organization.joinEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    {organization.timezone && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Timezone</span>
                        <span className="text-sm font-medium">{organization.timezone}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Created</span>
                      <span className="text-sm font-medium">
                        {formatDate(organization.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <Users className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="text-lg font-semibold">{organization.memberCount}</div>
                        <div className="text-xs text-muted-foreground">Members</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <Building2 className="h-4 w-4 text-purple-600" />
                      <div>
                        <div className="text-lg font-semibold">{organization.teamCount}</div>
                        <div className="text-xs text-muted-foreground">Teams</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Your Role */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Your Role</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(organization.userRole.name)}>
                      {organization.userRole.name}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Permissions Preview */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Permissions</h3>
                  <div className="space-y-3">
                    {/* Organization Permissions */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">
                        Organization
                      </h4>
                      <div className="grid grid-cols-2 gap-1">
                        {organization.userRole.permissions.organization &&
                          Object.entries(organization.userRole.permissions.organization).map(
                            ([key, value]) => (
                              <div
                                key={`org-${key}`}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                                <Badge
                                  variant={value ? 'default' : 'secondary'}
                                  className="text-xs h-5"
                                >
                                  {value ? '✓' : '✗'}
                                </Badge>
                              </div>
                            ),
                          )}
                      </div>
                    </div>

                    {/* Team Permissions */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Teams</h4>
                      <div className="grid grid-cols-2 gap-1">
                        {organization.userRole.permissions.teams &&
                          Object.entries(organization.userRole.permissions.teams).map(
                            ([key, value]) => (
                              <div
                                key={`team-${key}`}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                                <Badge
                                  variant={value ? 'default' : 'secondary'}
                                  className="text-xs h-5"
                                >
                                  {value ? '✓' : '✗'}
                                </Badge>
                              </div>
                            ),
                          )}
                      </div>
                    </div>

                    {/* Member Permissions */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Members</h4>
                      <div className="grid grid-cols-2 gap-1">
                        {organization.userRole.permissions.members &&
                          Object.entries(organization.userRole.permissions.members).map(
                            ([key, value]) => (
                              <div
                                key={`member-${key}`}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                                <Badge
                                  variant={value ? 'default' : 'secondary'}
                                  className="text-xs h-5"
                                >
                                  {value ? '✓' : '✗'}
                                </Badge>
                              </div>
                            ),
                          )}
                      </div>
                    </div>

                    {/* Project Permissions */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Projects</h4>
                      <div className="grid grid-cols-2 gap-1">
                        {organization.userRole.permissions.projects &&
                          Object.entries(organization.userRole.permissions.projects).map(
                            ([key, value]) => (
                              <div
                                key={`project-${key}`}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                                <Badge
                                  variant={value ? 'default' : 'secondary'}
                                  className="text-xs h-5"
                                >
                                  {value ? '✓' : '✗'}
                                </Badge>
                              </div>
                            ),
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-2">
              {organization.userRole.permissions.teams?.create && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setTeamManagementOpen(true);
                  }}
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  Manage Teams
                </Button>
              )}
              {organization.userRole.permissions.teams?.manageMembers && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setInviteOpen(true);
                  }}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Invite to Team
                </Button>
              )}
              {organization.userRole.permissions.organization?.edit && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSettingsOpen(true);
                  }}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Organization Settings
                </Button>
              )}
              {organization.userRole.permissions.audit?.view && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setAuditLogsOpen(true);
                  }}
                  className="gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Audit Logs
                </Button>
              )}
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className={
                !(
                  organization.userRole.permissions.organization?.edit ||
                  organization.userRole.permissions.audit?.view ||
                  organization.userRole.permissions.teams?.manageMembers
                )
                  ? 'ml-auto'
                  : ''
              }
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {organization.userRole.permissions.organization?.edit && (
        <OrganizationSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          organization={organization}
          onOrganizationUpdate={onOrganizationUpdate}
        />
      )}

      {organization.userRole.permissions.audit?.view && (
        <OrganizationAuditLogsModal
          open={auditLogsOpen}
          onOpenChange={setAuditLogsOpen}
          organizationSlug={organization.slug}
        />
      )}

      {organization.userRole.permissions.teams?.manageMembers && (
        <TeamInviteModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          organizationSlug={organization.slug}
        />
      )}

      {organization.userRole.permissions.teams?.create && (
        <TeamManagementModal
          open={teamManagementOpen}
          onOpenChange={setTeamManagementOpen}
          organizationSlug={organization.slug}
        />
      )}
    </>
  );
};
