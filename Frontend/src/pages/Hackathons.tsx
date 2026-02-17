import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import {
  Calendar,
  ExternalLink,
  Filter,
  Globe,
  Info,
  MapPin,
  Search,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface HackathonDetail {
  url?: string;
  title?: string;
  description?: string;
  overview?: string;
  aboutOrganizer?: string;
  eligibilityCriteria?: string;
  teamComposition?: string;
  registrationDeadline?: string;
  firstWinner?: string;
  firstRunnerUp?: string;
  secondRunnerUp?: string;
  allPresenters?: string;
  totalPrizePool?: string;
  registrationFee?: string;
  theme?: string;
  hackathonStarts?: string;
  resultsAnnouncements?: string;
  contactEmail?: string;
  contactPhoneNo?: string;
  contactWebsite?: string;
  isProcessed: boolean;
}

// Helper to determine if a theme is "valid" (short and looking like a theme)
// If invalid, we categorize it as 'General' or similar internal tag,
// and in UI we might hide the badge or show 'General'
const isValidTheme = (theme?: string): boolean => {
  if (!theme) return false;
  const t = theme.trim();
  return t.length > 0 && t.length <= 60; // Increased to 60 chars
};

const normalizeTheme = (theme?: string): string | null => {
  if (isValidTheme(theme)) return theme!.trim();
  return null;
};

const Hackathons = () => {
  const [hackathons, setHackathons] = useState<HackathonDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState('all');

  useEffect(() => {
    fetchHackathons();
  }, []);

  const fetchHackathons = async () => {
    try {
      setLoading(true);
      const response = await apiRequest<{ success: boolean; data: HackathonDetail[] }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/hackathons`,
      );
      if (response.success) {
        setHackathons(response.data);
      }
    } catch (error) {
      console.error('Error fetching hackathons:', error);
      toast.error('Failed to load hackathons. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate Unique Valid Themes
  const uniqueThemes = useMemo(() => {
    const themes = new Set<string>();
    hackathons.forEach((h) => {
      const normalized = normalizeTheme(h.theme);
      if (normalized) {
        themes.add(normalized);
      }
    });
    return Array.from(themes).sort();
  }, [hackathons]);

  // Filtering Logic
  const filteredHackathons = useMemo(() => {
    return hackathons.filter((h) => {
      const normalizedTheme = normalizeTheme(h.theme);

      const matchesSearch =
        h.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        false ||
        h.theme?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        false ||
        h.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        false;

      // If selectedTheme is 'all', matches everything.
      // If selectedTheme is specific, h.theme MUST strictly match (normalized).
      const matchesTheme = selectedTheme === 'all' || normalizedTheme === selectedTheme;

      const matchesPrice =
        selectedPrice === 'all' ||
        (() => {
          const fee = h.registrationFee?.toLowerCase() || '';
          if (selectedPrice === 'free') return fee.includes('free') || fee.includes('0');
          if (selectedPrice === 'paid')
            return !fee.includes('free') && !fee.includes('0') && fee.length > 0;
          return true;
        })();

      // Simple status check based on deadline string parsing if possible, else ignored for now as dates vary format
      const matchesStatus =
        selectedStatus === 'all' ||
        (() => {
          if (!h.registrationDeadline) return false;
          return true;
        })();

      return matchesSearch && matchesTheme && matchesPrice && matchesStatus;
    });
  }, [hackathons, searchQuery, selectedTheme, selectedStatus, selectedPrice]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTheme('all');
    setSelectedStatus('all');
    setSelectedPrice('all');
  };

  const hasActiveFilters =
    searchQuery || selectedTheme !== 'all' || selectedStatus !== 'all' || selectedPrice !== 'all';

  return (
    <div className="container mx-auto py-10 px-4 md:px-8 space-y-8 max-w-7xl">
      {/* Header Section */}
      <div className="flex flex-col gap-6 border-b border-border pb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">Hackathons</h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl leading-relaxed">
              Discover top-tier engineering challenges. Filter by theme, price, and status.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="mr-2 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by title, theme, or description..."
              className="pl-9 h-10 bg-background w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Select value={selectedTheme} onValueChange={setSelectedTheme}>
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Themes</SelectItem>
                {uniqueThemes.map((theme) => (
                  <SelectItem key={theme} value={theme}>
                    {theme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPrice} onValueChange={setSelectedPrice}>
              <SelectTrigger className="w-[130px] h-10">
                <SelectValue placeholder="Price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Price</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[140px] h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="flex flex-col h-[400px]">
              <CardHeader className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-4 flex-grow">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-20 w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredHackathons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHackathons.map((hackathon, index) => (
            <HackathonCard key={hackathon.url || index} hackathon={hackathon} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-muted/30 rounded-lg border border-dashed">
          <div className="p-4 bg-background rounded-full border shadow-sm">
            <Filter className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-medium">No hackathons found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              We couldn't find any hackathons matching your current filters.
            </p>
          </div>
          <Button variant="outline" onClick={clearFilters}>
            Clear All Filters
          </Button>
        </div>
      )}
    </div>
  );
};

const HackathonCard = ({ hackathon }: { hackathon: HackathonDetail }) => {
  // Only separate valid themes
  const validTheme = isValidTheme(hackathon.theme) ? hackathon.theme!.trim() : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="group flex flex-col h-full hover:shadow-md transition-all duration-200 cursor-pointer border-border/60 hover:border-border/80 bg-card overflow-hidden">
          <CardHeader className="pb-3 space-y-3">
            {/* Badges Row - Wrap Enabled */}
            <div className="flex flex-wrap items-start gap-2 mb-1 w-full overflow-hidden">
              {validTheme && (
                <Badge
                  variant="secondary"
                  className="font-normal rounded-md px-2.5 py-0.5 whitespace-nowrap text-left max-w-[140px] truncate"
                >
                  {validTheme}
                </Badge>
              )}
              {hackathon.registrationFee && (
                <Badge
                  variant="outline"
                  className={cn(
                    'font-normal rounded-md border-dashed px-2.5 py-0.5 whitespace-nowrap text-left max-w-[100px] truncate',
                    hackathon.registrationFee.toLowerCase().includes('free') ||
                      hackathon.registrationFee.includes('0')
                      ? 'text-green-600 bg-green-500/5 border-green-200 dark:border-green-900'
                      : 'text-muted-foreground',
                  )}
                >
                  {hackathon.registrationFee}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <h3
                className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2 min-h-[1.5em] tracking-tight"
                title={hackathon.title}
              >
                {hackathon.title}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate w-full">
                  {hackathon.aboutOrganizer || 'Organizer not specified'}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-grow pb-3 w-full">
            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed break-words">
              {hackathon.description}
            </p>
          </CardContent>

          <CardFooter className="pt-3 border-t bg-muted/5 p-4 flex justify-between items-center text-xs text-muted-foreground mt-auto w-full">
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[100px]">
                {hackathon.registrationDeadline || 'TBA'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Trophy className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium truncate max-w-[80px] text-right">
                {hackathon.totalPrizePool || 'Prizes'}
              </span>
            </div>
          </CardFooter>
        </Card>
      </DialogTrigger>

      {/* Modal Content */}
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 sm:rounded-xl overflow-hidden focus:outline-none">
        <div className="flex-none p-6 pb-4 border-b bg-card z-10">
          <div className="space-y-1 mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {validTheme && (
                <Badge
                  variant="secondary"
                  className="font-normal rounded-md px-2.5 py-1 whitespace-normal text-left leading-snug h-auto max-w-full"
                >
                  {validTheme}
                </Badge>
              )}
              {hackathon.registrationFee && (
                <Badge
                  variant="outline"
                  className="font-normal rounded-md border-dashed px-2.5 py-1 whitespace-normal text-left leading-snug h-auto max-w-full"
                >
                  Fee: {hackathon.registrationFee}
                </Badge>
              )}
            </div>
            <DialogTitle className="text-2xl font-bold leading-tight break-words pr-8">
              {hackathon.title}
            </DialogTitle>
            {hackathon.aboutOrganizer && (
              <DialogDescription className="flex items-center gap-1.5 text-sm pt-1 break-words">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                Hosted by {hackathon.aboutOrganizer}
              </DialogDescription>
            )}
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-4 pt-2">
            <SimpleStat
              label="Deadline"
              value={hackathon.registrationDeadline}
              icon={<Calendar className="h-4 w-4" />}
            />
            <SimpleStat
              label="Starts"
              value={hackathon.hackathonStarts}
              icon={<Calendar className="h-4 w-4" />}
            />
            <SimpleStat
              label="Team Size"
              value={hackathon.teamComposition}
              icon={<Users className="h-4 w-4" />}
            />
            <SimpleStat
              label="Prize Pool"
              value={hackathon.totalPrizePool}
              icon={<Trophy className="h-4 w-4" />}
            />
          </div>
        </div>

        <div className="flex-grow overflow-y-auto bg-muted/5 p-6 space-y-8 scroll-smooth">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" /> About the Challenge
            </h4>
            <div className="text-sm leading-7 text-foreground/90 whitespace-pre-wrap break-words">
              {hackathon.overview ||
                hackathon.description ||
                'No detailed overview available provided.'}
            </div>
          </section>

          {hackathon.eligibilityCriteria && (
            <section className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Eligibility
              </h4>
              <div className="text-sm leading-7 text-muted-foreground bg-muted/50 p-4 rounded-lg border break-words">
                {hackathon.eligibilityCriteria}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(hackathon.firstWinner || hackathon.firstRunnerUp || hackathon.secondRunnerUp) && (
              <section className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Prizes
                </h4>
                <div className="space-y-2 rounded-lg border bg-card p-4">
                  {hackathon.firstWinner && (
                    <PrizeRow place="1st Place" value={hackathon.firstWinner} />
                  )}
                  {hackathon.firstRunnerUp && (
                    <PrizeRow place="2nd Place" value={hackathon.firstRunnerUp} />
                  )}
                  {hackathon.secondRunnerUp && (
                    <PrizeRow place="3rd Place" value={hackathon.secondRunnerUp} />
                  )}
                </div>
              </section>
            )}

            {hackathon.allPresenters && (
              <section className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Speakers & Judges
                </h4>
                <div className="text-sm leading-relaxed text-muted-foreground bg-muted/50 p-4 rounded-lg border break-words">
                  {hackathon.allPresenters}
                </div>
              </section>
            )}
          </div>

          {(hackathon.contactEmail || hackathon.contactPhoneNo || hackathon.contactWebsite) && (
            <section className="space-y-3 pt-4 border-t border-dashed">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Contact Info
              </h4>
              <div className="flex flex-wrap gap-4 text-sm">
                {hackathon.contactEmail && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Email:</span>{' '}
                    <span className="break-all select-all">{hackathon.contactEmail}</span>
                  </div>
                )}
                {hackathon.contactPhoneNo && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Phone:</span>{' '}
                    {hackathon.contactPhoneNo}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="flex-none p-4 border-t bg-card flex justify-end gap-3 z-10">
          <DialogTrigger asChild>
            <Button variant="outline">Close</Button>
          </DialogTrigger>
          {hackathon.url && (
            <Button className="w-full sm:w-auto font-medium" asChild>
              <a href={hackathon.url} target="_blank" rel="noopener noreferrer">
                Register Now <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SimpleStat = ({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string;
  icon: React.ReactNode;
}) => {
  if (!value || value === 'N/A') return null;
  return (
    <div className="space-y-1 min-w-[100px]">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
        {icon} {label}
      </span>
      <p className="text-sm font-medium leading-none">{value}</p>
    </div>
  );
};

const PrizeRow = ({ place, value }: { place: string; value: string }) => (
  <div className="flex justify-between items-center text-sm border-b last:border-0 pb-2 last:pb-0 border-border/50">
    <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">
      {place}
    </span>
    <span className="font-medium text-foreground">{value}</span>
  </div>
);

export default Hackathons;
