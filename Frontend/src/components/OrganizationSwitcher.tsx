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

import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Separator } from '../components/ui/separator';
import { useOrganization } from '../contexts/OrganizationContext';
import { CreateOrganizationModal } from './CreateOrganizationModal';
import { OrganizationsModal } from './OrganizationsModal';

export const OrganizationSwitcher = () => {
  const { organizations, currentOrganization, setCurrentOrganization, loading } = useOrganization();
  const [open, setOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);

  if (loading) {
    return (
      <Button variant="outline" disabled className="w-full sm:w-[280px] justify-start">
        <Building2 className="mr-2 h-4 w-4 animate-pulse" />
        Loading...
      </Button>
    );
  }

  if (organizations.length === 0) {
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setCreateModalOpen(true)}
          className="w-full sm:w-[280px] justify-start"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Organization
        </Button>
        <CreateOrganizationModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      </>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select organization"
            className="w-full sm:w-[280px] justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{currentOrganization?.name || 'Select organization'}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full sm:w-[280px] p-0" align="start" sideOffset={4}>
          <div className="flex flex-col">
            <div className="px-2 py-2">
              <p className="text-xs font-medium text-muted-foreground px-2">Organizations</p>
            </div>
            <Separator />
            <div className="max-h-[300px] overflow-y-auto p-1">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                  onClick={() => {
                    setCurrentOrganization(org);
                    setOpen(false);
                  }}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border bg-background">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span className="flex-1 truncate text-left">{org.name}</span>
                  {currentOrganization?.id === org.id && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
            <Separator />
            <div className="p-1">
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                onClick={() => {
                  setCreateModalOpen(true);
                  setOpen(false);
                }}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="flex-1 text-left">Create Organization</span>
              </button>
              {organizations.length > 0 && (
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                  onClick={() => {
                    setManageModalOpen(true);
                    setOpen(false);
                  }}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-left">Manage Organizations</span>
                </button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <CreateOrganizationModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <OrganizationsModal open={manageModalOpen} onOpenChange={setManageModalOpen} />
    </>
  );
};
