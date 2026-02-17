import { useMutation, useQuery } from '@tanstack/react-query';
import { Upload, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '../lib/apiClient';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';

interface Team {
  id: string;
  name: string;
  slug: string;
}

interface TeamRole {
  id: string;
  roleName: string;
}

interface TeamInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  onInviteSent?: () => void;
  onCreateTeam?: () => void;
}

interface InviteEntry {
  email: string;
  roleId: string;
  firstName?: string;
  lastName?: string;
}

export const TeamInviteModal = ({
  open,
  onOpenChange,
  organizationSlug,
  onInviteSent,
  onCreateTeam,
}: TeamInviteModalProps) => {
  const singleInviteMutation = useMutation({
    mutationFn: (data: InviteEntry) =>
      apiRequest(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/team/${selectedTeamSlug}/invites`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      toast.success('Team invitation is being processed');
      setSingleInvite({ email: '', roleId: '', firstName: '', lastName: '' });
      onInviteSent?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });

  const bulkInviteMutation = useMutation({
    mutationFn: (invites: InviteEntry[]) =>
      apiRequest<{ summary: any }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/team/${selectedTeamSlug}/invites/bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invites }),
        },
      ),
    onSuccess: (data) => {
      toast.success(`${data.summary.total} invitations are being processed`);
      setBulkInvites([{ email: '', roleId: '', firstName: '', lastName: '' }]);
      onInviteSent?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send invitations');
    },
  });

  const csvUploadMutation = useMutation({
    mutationFn: (csvContent: string) =>
      apiRequest<{ summary: any }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/team/${selectedTeamSlug}/invites/csv`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent }),
        },
      ),
    onSuccess: (data) => {
      toast.success(`CSV Processed: ${data.summary.total} invitations are being processed`);
      setCsvContent('');
      setCsvFile(null);
      onInviteSent?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to Process CSV: ${error.message || 'An error occurred'}`);
    },
  });

  const jsonValidateMutation = useMutation({
    mutationFn: (jsonContent: string) =>
      apiRequest<{ summary: any; validInvites: InviteEntry[]; invalidInvites: InviteEntry[] }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/team/${selectedTeamSlug}/invites/json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonContent }),
        },
      ),
    onSuccess: (data) => {
      setJsonValidation({
        valid: data.summary.valid,
        invalid: data.summary.invalid,
        total: data.summary.total,
        validInvites: data.validInvites,
        invalidInvites: data.invalidInvites,
      });
      toast.success(
        `JSON parsed: ${data.summary.valid} valid, ${data.summary.invalid} invalid invitations`,
      );
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to parse JSON');
    },
  });

  const jsonSendMutation = useMutation({
    mutationFn: (invites: InviteEntry[]) =>
      apiRequest<{ summary: any }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/team/${selectedTeamSlug}/invites/bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invites }),
        },
      ),
    onSuccess: (data) => {
      toast.success(`${data.summary.total} invitations are being processed`);
      setJsonContent('');
      setJsonValidation(null);
      onInviteSent?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send invitations');
    },
  });

  const loading =
    singleInviteMutation.isPending ||
    bulkInviteMutation.isPending ||
    csvUploadMutation.isPending ||
    jsonValidateMutation.isPending ||
    jsonSendMutation.isPending;
  const [activeTab, setActiveTab] = useState('single');
  const [selectedTeamSlug, setSelectedTeamSlug] = useState<string | undefined>();

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', organizationSlug],
    queryFn: () =>
      apiRequest<{ teams: Team[] }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/organization/${organizationSlug}/teams`,
      ).then((res) => res.teams || []),
    enabled: open,
    staleTime: 60000,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', organizationSlug, selectedTeamSlug],
    queryFn: () =>
      apiRequest<{ roles: TeamRole[] }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/organization/${organizationSlug}/team/${selectedTeamSlug}/roles`,
      ).then((res) => res.roles || []),
    enabled: !!selectedTeamSlug,
    staleTime: 60000,
  });

  // Single invite state
  const [singleInvite, setSingleInvite] = useState<InviteEntry>({
    email: '',
    roleId: '',
    firstName: '',
    lastName: '',
  });

  // Bulk invite state
  const [bulkInvites, setBulkInvites] = useState<InviteEntry[]>([
    { email: '', roleId: '', firstName: '', lastName: '' },
  ]);

  // CSV state
  const [csvContent, setCsvContent] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // JSON state
  const [jsonContent, setJsonContent] = useState('');
  const [jsonValidation, setJsonValidation] = useState<{
    valid: number;
    invalid: number;
    total: number;
    validInvites?: InviteEntry[];
    invalidInvites?: InviteEntry[];
  } | null>(null);

  const handleSingleInvite = () => {
    if (!selectedTeamSlug) {
      toast.error('Please select a team first');
      return;
    }

    if (!singleInvite.email || !singleInvite.roleId) {
      toast.error('Email and role are required');
      return;
    }

    singleInviteMutation.mutate(singleInvite);
  };

  const handleBulkInvite = () => {
    if (!selectedTeamSlug) {
      toast.error('Please select a team first');
      return;
    }

    const validInvites = bulkInvites.filter((inv) => inv.email && inv.roleId);

    if (validInvites.length === 0) {
      toast.error('Please add at least one invite with email and role');
      return;
    }

    bulkInviteMutation.mutate(validInvites);
  };

  const handleCSVUpload = () => {
    if (!selectedTeamSlug) {
      toast.error('Please select a team first');
      return;
    }

    if (!csvContent) {
      toast.error('Please upload or paste CSV content');
      return;
    }

    csvUploadMutation.mutate(csvContent);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleJSONFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setJsonContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleJSONValidation = () => {
    if (!selectedTeamSlug) {
      toast.error('Please select a team first');
      return;
    }

    if (!jsonContent) {
      toast.error('Please upload or paste JSON content');
      return;
    }

    jsonValidateMutation.mutate(jsonContent);
  };

  const handleJSONSendInvites = () => {
    if (!jsonValidation || !jsonValidation.validInvites) {
      toast.error('Please validate JSON first');
      return;
    }

    jsonSendMutation.mutate(jsonValidation.validInvites);
  };

  const addBulkInviteRow = () => {
    setBulkInvites([...bulkInvites, { email: '', roleId: '', firstName: '', lastName: '' }]);
  };

  const removeBulkInviteRow = (index: number) => {
    setBulkInvites(bulkInvites.filter((_, i) => i !== index));
  };

  const updateBulkInvite = (index: number, field: keyof InviteEntry, value: string) => {
    const updated = [...bulkInvites];
    updated[index] = { ...updated[index], [field]: value };
    setBulkInvites(updated);
  };

  const downloadSampleCSV = () => {
    const sample = `email,roleId,firstName,lastName
john.doe@example.com,${roles[0]?.id || 'role_id_here'},John,Doe
jane.smith@example.com,${roles[0]?.id || 'role_id_here'},Jane,Smith`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'team_invite_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Members
          </DialogTitle>
          <DialogDescription>
            Invite people to join your team via email invitation
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-2 mb-4">
            <Label htmlFor="team-select">Select Team *</Label>
            <Select
              value={selectedTeamSlug}
              onValueChange={setSelectedTeamSlug}
              disabled={loadingTeams || teams.length === 0}
            >
              <SelectTrigger id="team-select">
                <SelectValue placeholder={loadingTeams ? 'Loading teams...' : 'Select a team'} />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.slug}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teams.length === 0 && !loadingTeams && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">
                  No teams available. Create a team first to send invitations.
                </p>
                {onCreateTeam && (
                  <Button variant="outline" onClick={onCreateTeam}>
                    Create Team
                  </Button>
                )}
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="single">Single Invite</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Invite</TabsTrigger>
              <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              <TabsTrigger value="json">JSON Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={singleInvite.email}
                    onChange={(e) => setSingleInvite({ ...singleInvite, email: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={singleInvite.roleId}
                    onValueChange={(value) => setSingleInvite({ ...singleInvite, roleId: value })}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent className="z-9999" position="popper">
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.roleName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name (Optional)</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={singleInvite.firstName}
                      onChange={(e) =>
                        setSingleInvite({ ...singleInvite, firstName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name (Optional)</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={singleInvite.lastName}
                      onChange={(e) =>
                        setSingleInvite({ ...singleInvite, lastName: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4 mt-4">
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                {bulkInvites.map((invite, index) => (
                  <div key={index} className="flex gap-2 items-start border-b pb-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Email *"
                        type="email"
                        value={invite.email}
                        onChange={(e) => updateBulkInvite(index, 'email', e.target.value)}
                      />
                      <Select
                        value={invite.roleId}
                        onValueChange={(value) => updateBulkInvite(index, 'roleId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Role *" />
                        </SelectTrigger>
                        <SelectContent className="z-9999" position="popper">
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.roleName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="First Name"
                        value={invite.firstName}
                        onChange={(e) => updateBulkInvite(index, 'firstName', e.target.value)}
                      />
                      <Input
                        placeholder="Last Name"
                        value={invite.lastName}
                        onChange={(e) => updateBulkInvite(index, 'lastName', e.target.value)}
                      />
                    </div>
                    {bulkInvites.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeBulkInviteRow(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={addBulkInviteRow} className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Another
              </Button>
            </TabsContent>

            <TabsContent value="csv" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>CSV Format</Label>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with columns: email, roleId, firstName, lastName
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={downloadSampleCSV} size="sm">
                    Download Sample
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="csvFile">Upload CSV File</Label>
                <div className="mt-2">
                  <label
                    htmlFor="csvFile"
                    className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {csvFile ? csvFile.name : 'Click to upload CSV file'}
                      </p>
                    </div>
                    <input
                      id="csvFile"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor="csvContent">Or Paste CSV Content</Label>
                <Textarea
                  id="csvContent"
                  placeholder="email,roleId,firstName,lastName&#10;user@example.com,role_id,John,Doe"
                  rows={8}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="json" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="jsonFile">JSON File Upload</Label>
                  <Input
                    id="jsonFile"
                    type="file"
                    accept=".json"
                    onChange={handleJSONFileUpload}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload a JSON file or paste JSON content below
                  </p>
                </div>

                <div>
                  <Label htmlFor="jsonContent">JSON Content</Label>
                  <Textarea
                    id="jsonContent"
                    placeholder={`[
  {
    "email": "user1@example.com",
    "roleId": "role-id-here",
    "firstName": "John",
    "lastName": "Doe"
  },
  {
    "email": "user2@example.com",
    "roleId": "role-id-here",
    "firstName": "Jane",
    "lastName": "Smith"
  }
]`}
                    value={jsonContent}
                    onChange={(e) => setJsonContent(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>

                {jsonValidation && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-2">Validation Results</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-green-600 font-medium">{jsonValidation.valid}</span>{' '}
                        valid
                      </div>
                      <div>
                        <span className="text-red-600 font-medium">{jsonValidation.invalid}</span>{' '}
                        invalid
                      </div>
                      <div>
                        <span className="font-medium">{jsonValidation.total}</span> total
                      </div>
                    </div>
                    {jsonValidation.valid > 0 && (
                      <Button
                        onClick={handleJSONSendInvites}
                        disabled={loading}
                        className="mt-3 w-full"
                        size="sm"
                      >
                        Send {jsonValidation.valid} Valid Invitations
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleJSONValidation}
                    disabled={loading || !jsonContent}
                    variant="outline"
                    size="sm"
                  >
                    Validate JSON
                  </Button>
                  <Button
                    onClick={() => {
                      setJsonContent('');
                      setJsonValidation(null);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={
              activeTab === 'single'
                ? handleSingleInvite
                : activeTab === 'bulk'
                  ? handleBulkInvite
                  : activeTab === 'csv'
                    ? handleCSVUpload
                    : () => {} // JSON handled within tab
            }
            disabled={loading || activeTab === 'json'}
          >
            {loading ? 'Sending...' : 'Send Invitations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
