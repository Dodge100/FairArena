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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// --- Types ---
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

interface CalendarEvent extends HackathonDetail {
  parsedDate: Date;
  type: 'start' | 'deadline';
}

// --- Helpers ---
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Parse strings like: "30 Jan 26, 09:30 AM EST"
const parseDateString = (dateStr?: string): Date | null => {
  if (!dateStr || dateStr === 'TBA') return null;

  // Regex for "DD Mon YY" part. We ignore time/timezone for simple calendar placement for now to avoid timezone hell
  // Example: "30 Jan 26"
  const match = dateStr.match(/(\d+)\s+([A-Za-z]+)\s+(\d+)/);
  if (!match) return null;

  const [_, day, monthStr, yearShort] = match;
  const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === monthStr.toLowerCase());
  if (monthIndex === -1) return null;

  const year = 2000 + parseInt(yearShort, 10);
  const dayNum = parseInt(day, 10);

  return new Date(year, monthIndex, dayNum);
};

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

// --- Components ---

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
        const processedEvents: CalendarEvent[] = [];
        response.data.forEach((h) => {
          const startDate = parseDateString(h.hackathonStarts);
          if (startDate) {
            processedEvents.push({ ...h, parsedDate: startDate, type: 'start' });
          }
          // Optionally populate deadlines too if needed, but might clutter.
          // Let's stick to Start Date as the primary event for now.
          // If start date is missing, maybe rely on deadline?
          if (!startDate) {
            const deadline = parseDateString(h.registrationDeadline);
            if (deadline) {
              processedEvents.push({ ...h, parsedDate: deadline, type: 'deadline' });
            }
          }
        });
        setEvents(processedEvents);
      }
    } catch (error) {
      console.error('Error fetching hackathons:', error);
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayOfWeek = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  // Generate grid cells
  const days = [];
  // Empty cells for previous month padding
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  // Actual days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDialogOpen(true);
  };

  const getEventsForDay = (date: Date) => {
    return events.filter((e) => isSameDay(e.parsedDate, date));
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-8 max-w-7xl animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">Events Calendar</h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl leading-relaxed">
              Stay ahead of the curve. Track upcoming hackathons and deadlines.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-muted/30 p-1 rounded-lg border">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="hover:bg-background">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[120px] text-center">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="hover:bg-background">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-xl shadow-sm bg-card overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/20 border-b">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-3 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[120px] divide-x divide-y">
          {days.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="bg-muted/5" />;

            const dayEvents = getEventsForDay(date);
            const isToday = isSameDay(date, new Date());

            return (
              <div
                key={date.toISOString()}
                onClick={() => handleDayClick(date)}
                className={cn(
                  'p-2 relative group cursor-pointer transition-colors hover:bg-muted/10',
                  isToday && 'bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 text-sm rounded-full font-medium',
                    isToday
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground group-hover:text-foreground',
                  )}
                >
                  {date.getDate()}
                </span>

                <div className="mt-2 space-y-1 overflow-hidden max-h-[80px]">
                  {dayEvents.slice(0, 3).map((evt, i) => (
                    <div
                      key={i}
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded truncate font-medium border',
                        evt.type === 'start'
                          ? 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400 dark:border-blue-900'
                          : 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400 dark:border-orange-900',
                      )}
                    >
                      {evt.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Details Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md md:max-w-lg lg:max-w-4xl p-0 gap-0 overflow-hidden sm:rounded-xl max-h-[90vh]">
          <div className="p-4 border-b bg-muted/5 flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Events for {selectedDate?.toLocaleDateString(undefined, { dateStyle: 'full' })}
            </DialogTitle>
          </div>

          <ScrollArea className="max-h-[70vh] p-4 bg-muted/5">
            {selectedDate && getEventsForDay(selectedDate).length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {getEventsForDay(selectedDate).map((evt, idx) => (
                  <HackathonDetailCard key={idx} hackathon={evt} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Clock className="h-10 w-10 mb-2 opacity-20" />
                <p>No events scheduled for this day.</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Reused/Condensed version of Hackathon Card for the Calendar Detail View
const HackathonDetailCard = ({ hackathon }: { hackathon: HackathonDetail }) => {
  return (
    <Card className="flex flex-col h-full border-border/60 hover:border-primary/50 transition-colors shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className="mb-2 max-w-[150px] truncate">
            {hackathon.theme && hackathon.theme.length < 30 ? hackathon.theme : 'Hackathon'}
          </Badge>
          {hackathon.registrationFee && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border">
              {hackathon.registrationFee}
            </span>
          )}
        </div>
        <CardTitle className="text-base leading-tight line-clamp-2" title={hackathon.title}>
          {hackathon.title}
        </CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{hackathon.aboutOrganizer || 'Online'}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-grow text-sm">
        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {hackathon.description}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-dashed">
          <div className="space-y-0.5">
            <span className="text-muted-foreground block">Deadline</span>
            <span className="font-medium">{hackathon.registrationDeadline || 'TBA'}</span>
          </div>
          <div className="space-y-0.5 text-right">
            <span className="text-muted-foreground block">Prize Pool</span>
            <span className="font-medium">{hackathon.totalPrizePool || 'N/A'}</span>
          </div>
        </div>

        {hackathon.url && (
          <Button size="sm" className="w-full mt-auto gap-2" asChild>
            <a href={hackathon.url} target="_blank" rel="noopener noreferrer">
              View Details <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default Calendar;
