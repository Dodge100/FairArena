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
import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { toast } from 'sonner';

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
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);

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

        setLoading(true);
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/teams`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${await getToken()}`,
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        name: formData.name,
                        slug: formData.slug,
                        description: formData.description || undefined,
                        visibility: formData.visibility,
                        joinEnabled: formData.joinEnabled,
                        timezone: formData.timezone || undefined,
                        website: formData.website || undefined,
                        logoUrl: formData.logoUrl || undefined,
                        location: formData.location || undefined,
                    }),
                }
            );

            if (response.ok) {
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
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to create team');
            }
        } catch (error) {
            console.error('Error creating team:', error);
            toast.error('Failed to create team');
        } finally {
            setLoading(false);
        }
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
                                pattern="^[a-z0-9-]+$"
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
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Creating...' : 'Create Team'}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
