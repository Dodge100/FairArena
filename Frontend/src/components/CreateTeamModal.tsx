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

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '../lib/apiClient';

interface CreateTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  onTeamCreated?: () => void;
}

export function CreateTeamModal({
  open,
  onOpenChange,
  organizationSlug,
  onTeamCreated,
}: CreateTeamModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    visibility: 'INTERNAL' as 'PUBLIC' | 'PRIVATE' | 'INTERNAL',
    joinEnabled: false,
    timezone: '',
    website: '',
    logoUrl: '',
    location: '',
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-generate slug from name if slug is empty
    if (field === 'name' && !formData.slug) {
      const autoSlug = value
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setFormData((prev) => ({ ...prev, slug: autoSlug }));
    }
  };

  const createTeamMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/teams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            slug: data.slug,
            description: data.description || undefined,
            visibility: data.visibility,
            joinEnabled: data.joinEnabled,
            timezone: data.timezone || undefined,
            website: data.website || undefined,
            logoUrl: data.logoUrl || undefined,
            location: data.location || undefined,
          }),
        },
      ),
    onSuccess: () => {
      toast.success(`Team "${formData.name}" is being created`);

      // Reset form
      setFormData({
        name: '',
        slug: '',
        description: '',
        visibility: 'INTERNAL',
        joinEnabled: false,
        timezone: '',
        website: '',
        logoUrl: '',
        location: '',
      });

      onTeamCreated?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create team');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.slug) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(formData.slug)) {
      toast.error('Slug must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    createTeamMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Create a new team in your organization. You will be assigned as the team owner.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="overflow-y-auto pr-2">
          <div className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Team Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Engineering Team"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                Team Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                placeholder="engineering-team"
                value={formData.slug}
                onChange={(e) => handleInputChange('slug', e.target.value)}
                maxLength={100}
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-xs text-muted-foreground">
                Only lowercase letters, numbers, and hyphens
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your team's purpose and goals..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) => handleInputChange('visibility', value)}
                >
                  <SelectTrigger id="visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={5} className="z-100">
                    <SelectItem value="PUBLIC">Public - Anyone can view</SelectItem>
                    <SelectItem value="INTERNAL">Internal - Organization members only</SelectItem>
                    <SelectItem value="PRIVATE">Private - Team members only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinEnabled">Join Settings</Label>
                <Select
                  value={formData.joinEnabled.toString()}
                  onValueChange={(value) => handleInputChange('joinEnabled', value === 'true')}
                >
                  <SelectTrigger id="joinEnabled">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={5} className="z-100">
                    <SelectItem value="false">Invite only</SelectItem>
                    <SelectItem value="true">Allow join requests</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="San Francisco, CA"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                placeholder="America/Los_Angeles"
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                value={formData.logoUrl}
                onChange={(e) => handleInputChange('logoUrl', e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createTeamMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTeamMutation.isPending}>
                {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
