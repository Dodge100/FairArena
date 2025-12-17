import { useAuth } from '@clerk/clerk-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { useOrganization } from '../contexts/OrganizationContext';

// Zod schema for form fields
const createOrganizationFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be less than 100 characters')
    .trim(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .trim()
    .toLowerCase(),
  timezone: z.string().optional(),
});

type CreateOrganizationFormData = z.infer<typeof createOrganizationFormSchema>;

interface CreateOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateOrganizationModal = ({ open, onOpenChange }: CreateOrganizationModalProps) => {
  const [joinEnabled, setJoinEnabled] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationFormData>({
    resolver: zodResolver(createOrganizationFormSchema),
  });
  const { getToken } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const watchedName = useWatch({ control, name: 'name' });

  useEffect(() => {
    if (watchedName) {
      const slug = watchedName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setValue('slug', slug);
    }
  }, [watchedName, setValue]);

  const onSubmit = async (data: CreateOrganizationFormData) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/create/new`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify({
            ...data,
            joinEnabled,
            isPublic,
          }),
          credentials: 'include',
        },
      );

      const result = await response.json();

      if (response.ok) {
        toast.success('Organization created successfully!');
        await refreshOrganizations();
        onOpenChange(false);
        reset();
      } else {
        if (result.error === 'Slug already exists' && result.suggestion) {
          toast.error(`Slug already exists. Try: ${result.suggestion}`);
        } else {
          toast.error(result.error || 'Failed to create organization');
        }
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Set up a new organization to collaborate with your team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Enter organization name"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              {...register('slug')}
              placeholder="unique-slug"
              className={errors.slug ? 'border-red-500' : ''}
            />
            <p className="text-sm text-gray-500">
              This will be your organization's URL identifier.
            </p>
            {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone (Optional)</Label>
            <Input id="timezone" {...register('timezone')} placeholder="America/New_York" />
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} />
            <Label htmlFor="isPublic">Public Organization</Label>
          </div>
          <p className="text-sm text-gray-500">Public organizations are visible to everyone.</p>

          <div className="flex items-center space-x-2">
            <Switch id="joinEnabled" checked={joinEnabled} onCheckedChange={setJoinEnabled} />
            <Label htmlFor="joinEnabled">Allow Users to Join</Label>
          </div>
          <p className="text-sm text-gray-500">
            Enable this to allow users to request to join your organization.
          </p>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
