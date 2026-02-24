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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/apiClient';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Fingerprint,
  Key,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface SecurityKey {
  id: string;
  name: string | null;
  deviceType: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface SecurityKeyManagerProps {
  onDeviceChange?: () => void;
}

export function SecurityKeyManager({ onDeviceChange }: SecurityKeyManagerProps) {
  const queryClient = useQueryClient();
  const isSupported = browserSupportsWebAuthn();
  const [registering, setRegistering] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const { data: securityKeys = [], isLoading: loading } = useQuery({
    queryKey: ['securityKeys'],
    queryFn: () =>
      apiRequest<{ success: boolean; data: SecurityKey[] }>(
        `${API_BASE}/api/v1/mfa/webauthn/devices`,
      ).then((res) => res.data),
    staleTime: 60000,
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const optionsRes = await apiRequest<{ success: boolean; data: any; message?: string }>(
        `${API_BASE}/api/v1/mfa/webauthn/register/options`,
        { method: 'POST' },
      );

      if (!optionsRes.success) {
        throw new Error(optionsRes.message || 'Failed to get registration options');
      }

      const credential = await startRegistration({
        optionsJSON: optionsRes.data as PublicKeyCredentialCreationOptionsJSON,
      });

      const verifyRes = await apiRequest<{ success: boolean; message?: string }>(
        `${API_BASE}/api/v1/mfa/webauthn/register/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response: credential }),
        },
      );

      if (!verifyRes.success) {
        throw new Error(verifyRes.message || 'Failed to verify registration');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityKeys'] });
      toast.success('Security key added successfully!');
      onDeviceChange?.();
    },
    onError: (error: any) => {
      const message = error instanceof Error ? error.message : 'Failed to register security key';
      if (
        message.includes('cancelled') ||
        message.includes('canceled') ||
        message.includes('AbortError')
      ) {
        toast.info('Registration cancelled');
      } else {
        toast.error(message);
      }
    },
  });

  const handleRegister = async () => {
    if (!isSupported) {
      toast.error('Security keys are not supported in this browser');
      return;
    }
    setRegistering(true);
    try {
      await registerMutation.mutateAsync();
    } finally {
      setRegistering(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`${API_BASE}/api/v1/mfa/webauthn/devices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityKeys'] });
      toast.success('Security key removed');
      onDeviceChange?.();
    },
    onError: (error: any) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete security key');
    },
  });

  const handleDelete = (id: string) => {
    setShowDropdown(null);
    deleteMutation.mutate(id);
  };

  // Rename methods
  const startRename = (key: SecurityKey) => {
    setRenamingId(key.id);
    setNewName(key.name || '');
    setShowDropdown(null);
  };

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest<{ success: boolean; message?: string }>(
        `${API_BASE}/api/v1/mfa/webauthn/devices/${id}/rename`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityKeys'] });
      setRenamingId(null);
      setNewName('');
      toast.success('Security key renamed');
    },
    onError: () => {
      toast.error('Failed to rename security key');
    },
  });

  const handleRename = (id: string) => {
    if (!newName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    renameMutation.mutate({ id, name: newName.trim() });
  };

  // Helper functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDeviceIcon = (deviceType: string | null) => {
    return deviceType === 'platform' ? (
      <Fingerprint className="w-5 h-5" />
    ) : (
      <Key className="w-5 h-5" />
    );
  };

  const deletingId = deleteMutation.isPending ? deleteMutation.variables : null;

  if (!isSupported) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Security Keys
            </CardTitle>
            <CardDescription className="mt-1">
              Use a physical security key (YubiKey, Titan Key) or biometric sensor (fingerprint,
              Face ID) as an unphishable second factor.
            </CardDescription>
          </div>
          <Button onClick={handleRegister} disabled={registering} size="sm" className="shrink-0">
            {registering ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Key
          </Button>
        </div>
        {/* Security key benefit banner */}
        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm text-primary font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Strongest Protection Available
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            When you add a security key, it becomes the <strong>only</strong> way to verify new
            devices. Email and notification codes will be disabled for maximum security.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : securityKeys.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Key className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No security keys configured</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Security keys provide the highest level of protection against phishing and account
                takeover. They work with USB keys (YubiKey), phones (passkeys), or built-in
                biometrics.
              </p>
            </div>
            <Button onClick={handleRegister} disabled={registering} variant="outline">
              {registering ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Your First Security Key
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {securityKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {getDeviceIcon(key.deviceType)}
                  </div>
                  <div>
                    {renamingId === key.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(key.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="px-2 py-1 text-sm border rounded-md bg-background"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleRename(key.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium">{key.name || 'Security Key'}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {formatDate(key.createdAt)}
                          {key.lastUsedAt && ` • Last used ${formatDate(key.lastUsedAt)}`}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {renamingId !== key.id && (
                  <div className="relative">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowDropdown(showDropdown === key.id ? null : key.id)}
                      disabled={deletingId === key.id}
                    >
                      {deletingId === key.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MoreVertical className="w-4 h-4" />
                      )}
                    </Button>

                    {showDropdown === key.id && (
                      <div className="absolute right-0 top-full mt-1 w-36 py-1 bg-popover border rounded-md shadow-lg z-10">
                        <button
                          onClick={() => startRename(key)}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                        >
                          <Pencil className="w-4 h-4" /> Rename
                        </button>
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-red-500"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
