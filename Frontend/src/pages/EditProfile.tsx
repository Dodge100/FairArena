import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useUser } from '@clerk/clerk-react';
import { ArrowLeft, Plus, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ProfileData {
  firstName: string;
  lastName: string;
  bio: string;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
  location: string;
  jobTitle: string;
  company: string;
  yearsOfExperience: number | string;
  experiences: string[];
  education: string[];
  skills: string[];
  languages: string[];
  interests: string[];
  certifications: string[];
  awards: string[];
  githubUsername: string;
  twitterHandle: string;
  linkedInProfile: string;
  resumeUrl: string;
  portfolioUrl: string;
  isPublic: boolean;
  requireAuth: boolean;
  trackViews: boolean;
}

export default function EditProfile() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    bio: '',
    gender: '',
    dateOfBirth: '',
    phoneNumber: '',
    location: '',
    jobTitle: '',
    company: '',
    yearsOfExperience: '',
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    interests: [],
    certifications: [],
    awards: [],
    githubUsername: '',
    twitterHandle: '',
    linkedInProfile: '',
    resumeUrl: '',
    portfolioUrl: '',
    isPublic: false,
    requireAuth: false,
    trackViews: false,
  });

  const [newEducation, setNewEducation] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [newExperience, setNewExperience] = useState('');
  const [newCertification, setNewCertification] = useState('');
  const [newAward, setNewAward] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // URL validation function
  const isValidUrl = (url: string): boolean => {
    if (!url || url.trim() === '') return true; // Empty is valid
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Validate URL field
  const validateUrlField = (field: string, value: string) => {
    if (!isValidUrl(value)) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: 'Please enter a valid URL or leave empty',
      }));
    } else {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate all URL fields
  const validateAllUrls = () => {
    const urlFields = ['linkedInProfile', 'portfolioUrl', 'resumeUrl'];
    let hasErrors = false;

    urlFields.forEach((field) => {
      const value = profile[field as keyof ProfileData] as string;
      if (!isValidUrl(value)) {
        setValidationErrors((prev) => ({
          ...prev,
          [field]: 'Please enter a valid URL or leave empty',
        }));
        hasErrors = true;
      }
    });

    return !hasErrors;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isLoaded || !user) return;

      try {
        setLoading(true);
        const token = await getToken();
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/v1/profile/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const profileData = data.data;
          setProfile({
            firstName: profileData.firstName || '',
            lastName: profileData.lastName || '',
            bio: profileData.bio || '',
            gender: profileData.gender || '',
            dateOfBirth: profileData.dateOfBirth
              ? new Date(profileData.dateOfBirth).toISOString().split('T')[0]
              : '',
            phoneNumber: profileData.phoneNumber || '',
            location: profileData.location || '',
            jobTitle: profileData.jobTitle || '',
            company: profileData.company || '',
            yearsOfExperience: profileData.yearsOfExperience ?? '',
            experiences: profileData.experiences || [],
            education: profileData.education || [],
            skills: profileData.skills || [],
            languages: profileData.languages || [],
            interests: profileData.interests || [],
            certifications: profileData.certifications || [],
            awards: profileData.awards || [],
            githubUsername: profileData.githubUsername || '',
            twitterHandle: profileData.twitterHandle || '',
            linkedInProfile: profileData.linkedInProfile || '',
            resumeUrl: profileData.resumeUrl || '',
            portfolioUrl: profileData.portfolioUrl || '',
            isPublic: profileData.isPublic || false,
            requireAuth: profileData.requireAuth || false,
            trackViews: profileData.trackViews || false,
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isLoaded, user, getToken]);

  const handleSave = async () => {
    if (!user) return;

    // Validate required fields
    if (!profile.firstName || !profile.firstName.trim()) {
      toast.error('First name is required');
      return;
    }

    // Validate all URL fields
    if (!validateAllUrls()) {
      toast.error('Please fix the validation errors before saving');
      return;
    }

    // Check for any remaining validation errors
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please fix the validation errors before saving');
      return;
    }

    try {
      setSaving(true);
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

      const payload = {
        ...profile,
        gender: profile.gender || null,
        yearsOfExperience: profile.yearsOfExperience ? Number(profile.yearsOfExperience) : null,
        dateOfBirth: profile.dateOfBirth || null,
      };

      const response = await fetch(`${apiUrl}/api/v1/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      // Profile is being processed asynchronously
      toast.success('Profile is being updated. Changes will reflect shortly.');

      // Navigate after a short delay to allow processing
      setTimeout(() => {
        navigate(`/profile/${user.id}`);
      }, 1500);
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const addItem = (key: keyof ProfileData, value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    const items = profile[key] as string[];
    if (!items.includes(value.trim())) {
      setProfile({ ...profile, [key]: [...items, value.trim()] });
    }
    setter('');
  };

  const removeItem = (key: keyof ProfileData, index: number) => {
    const items = profile[key] as string[];
    setProfile({ ...profile, [key]: items.filter((_, i) => i !== index) });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Edit Profile</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                rows={4}
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={profile.gender}
                  onValueChange={(value) => setProfile({ ...profile, gender: value })}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border dark:bg-black/80 dark:border-white/20">
  <SelectItem value="MALE">Male</SelectItem>
  <SelectItem value="FEMALE">Female</SelectItem>
  <SelectItem value="OTHER">Other</SelectItem>
  <SelectItem value="PREFER_NOT_TO_SAY">Prefer not to say</SelectItem>
</SelectContent>

                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={profile.dateOfBirth}
                  onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  value={profile.phoneNumber}
                  onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  placeholder="San Francisco, CA"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional Info */}
        <Card>
          <CardHeader>
            <CardTitle>Professional Information</CardTitle>
            <CardDescription>Your work experience and background</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  value={profile.jobTitle}
                  onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })}
                  placeholder="Software Engineer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                  placeholder="Tech Corp"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="yearsOfExperience">Years of Experience</Label>
              <Input
                id="yearsOfExperience"
                type="number"
                value={profile.yearsOfExperience}
                onChange={(e) => setProfile({ ...profile, yearsOfExperience: e.target.value })}
                placeholder="5"
                min="0"
              />
            </div>

            {/* Education */}
            <div className="space-y-2">
              <Label>Education</Label>
              <div className="flex gap-2">
                <Input
                  value={newEducation}
                  onChange={(e) => setNewEducation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem('education', newEducation, setNewEducation);
                    }
                  }}
                  placeholder="B.S. Computer Science, MIT"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addItem('education', newEducation, setNewEducation)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.education.map((edu, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {edu}
                    <button
                      type="button"
                      onClick={() => removeItem('education', index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Experiences */}
            <div className="space-y-2">
              <Label>Experiences</Label>
              <div className="flex gap-2">
                <Input
                  value={newExperience}
                  onChange={(e) => setNewExperience(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem('experiences', newExperience, setNewExperience);
                    }
                  }}
                  placeholder="Software Engineer at Google (2018-2022)"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addItem('experiences', newExperience, setNewExperience)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.experiences.map((exp, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {exp}
                    <button
                      type="button"
                      onClick={() => removeItem('experiences', index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <Label>Skills</Label>
              <div className="flex gap-2">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem('skills', newSkill, setNewSkill);
                    }
                  }}
                  placeholder="TypeScript, React, Node.js"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addItem('skills', newSkill, setNewSkill)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeItem('skills', index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-2">
              <Label>Languages</Label>
              <div className="flex gap-2">
                <Input
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem('languages', newLanguage, setNewLanguage);
                    }
                  }}
                  placeholder="English, Spanish"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addItem('languages', newLanguage, setNewLanguage)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.languages.map((lang, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {lang}
                    <button
                      type="button"
                      onClick={() => removeItem('languages', index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div className="space-y-2">
              <Label>Interests</Label>
              <div className="flex gap-2">
                <Input
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem('interests', newInterest, setNewInterest);
                    }
                  }}
                  placeholder="AI, Web Development, Design"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addItem('interests', newInterest, setNewInterest)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.interests.map((interest, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {interest}
                    <button
                      type="button"
                      onClick={() => removeItem('interests', index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card>
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
            <CardDescription>Add your professional certifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Certifications</Label>
              <div className="flex gap-2">
                <Input
                  value={newCertification}
                  onChange={(e) => setNewCertification(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem('certifications', newCertification, setNewCertification);
                    }
                  }}
                  placeholder="AWS Certified Solutions Architect"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addItem('certifications', newCertification, setNewCertification)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.certifications.map((cert, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {cert}
                    <button
                      type="button"
                      onClick={() => removeItem('certifications', index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Awards */}
        <Card>
          <CardHeader>
            <CardTitle>Awards & Honors</CardTitle>
            <CardDescription>Add your achievements and recognitions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Awards</Label>
              <div className="flex gap-2">
                <Input
                  value={newAward}
                  onChange={(e) => setNewAward(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem('awards', newAward, setNewAward);
                    }
                  }}
                  placeholder="Employee of the Year 2023"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addItem('awards', newAward, setNewAward)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.awards.map((award, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {award}
                    <button
                      type="button"
                      onClick={() => removeItem('awards', index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader>
            <CardTitle>Links & Social</CardTitle>
            <CardDescription>Your online presence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="githubUsername">GitHub Username</Label>
                <Input
                  id="githubUsername"
                  value={profile.githubUsername}
                  onChange={(e) => setProfile({ ...profile, githubUsername: e.target.value })}
                  placeholder="johndoe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterHandle">Twitter Handle</Label>
                <Input
                  id="twitterHandle"
                  value={profile.twitterHandle}
                  onChange={(e) => setProfile({ ...profile, twitterHandle: e.target.value })}
                  placeholder="johndoe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedInProfile">LinkedIn Profile URL</Label>
              <Input
                id="linkedInProfile"
                value={profile.linkedInProfile}
                onChange={(e) => setProfile({ ...profile, linkedInProfile: e.target.value })}
                onBlur={(e) => validateUrlField('linkedInProfile', e.target.value)}
                placeholder="https://linkedin.com/in/johndoe"
                className={validationErrors.linkedInProfile ? 'border-destructive' : ''}
              />
              {validationErrors.linkedInProfile && (
                <p className="text-sm text-destructive">{validationErrors.linkedInProfile}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolioUrl">Portfolio URL</Label>
              <Input
                id="portfolioUrl"
                value={profile.portfolioUrl}
                onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
                onBlur={(e) => validateUrlField('portfolioUrl', e.target.value)}
                placeholder="https://johndoe.com"
                className={validationErrors.portfolioUrl ? 'border-destructive' : ''}
              />
              {validationErrors.portfolioUrl && (
                <p className="text-sm text-destructive">{validationErrors.portfolioUrl}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="resumeUrl">Resume URL</Label>
              <Input
                id="resumeUrl"
                value={profile.resumeUrl}
                onChange={(e) => setProfile({ ...profile, resumeUrl: e.target.value })}
                onBlur={(e) => validateUrlField('resumeUrl', e.target.value)}
                placeholder="https://drive.google.com/..."
                className={validationErrors.resumeUrl ? 'border-destructive' : ''}
              />
              {validationErrors.resumeUrl && (
                <p className="text-sm text-destructive">{validationErrors.resumeUrl}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
            <CardDescription>Control who can see your profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="isPublic">Make profile public</Label>
                <p className="text-sm text-muted-foreground">
                  Allow anyone with the link to view your profile
                </p>
              </div>
              <Switch
                id="isPublic"
                checked={profile.isPublic}
                onCheckedChange={(checked) => setProfile({ ...profile, isPublic: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="requireAuth">Require authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Only signed-in users can view your profile
                </p>
              </div>
              <Switch
                id="requireAuth"
                checked={profile.requireAuth}
                disabled={!profile.isPublic}
                onCheckedChange={(checked) => {
                  setProfile({
                    ...profile,
                    requireAuth: checked,
                    trackViews: checked ? profile.trackViews : false
                  });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="trackViews">Track profile views</Label>
                <p className="text-sm text-muted-foreground">
                  Collect information about who viewed your profile (requires authentication)
                </p>
              </div>
              <Switch
                id="trackViews"
                checked={profile.trackViews}
                disabled={!profile.requireAuth}
                onCheckedChange={(checked) => setProfile({ ...profile, trackViews: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="flex justify-end gap-4 pb-8">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </div>
  );
}
