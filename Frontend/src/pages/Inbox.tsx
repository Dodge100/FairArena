import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStream } from '@/contexts/StreamContext';
import { apiRequest } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  Filter,
  Mail,
  Megaphone,
  MessageSquare,
  MoreVertical,
  Search,
  Star,
  Trash2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// Custom time formatting to avoid date-fns bundle size
const formatTimeAgo = (date: Date | string): string => {
  const now = new Date();
  const past = new Date(date);
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  description: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
}

const NOTIFICATION_TYPES = [
  'SYSTEM',
  'MENTION',
  'INVITATION',
  'ACHIEVEMENT',
  'UPDATE',
  'REMINDER',
  'ALERT',
  'MESSAGE',
  'FOLLOW',
  'STAR',
  'COMMENT',
  'ANNOUNCEMENT',
] as const;

const ICON_MAP: Record<string, React.ElementType> = {
  SYSTEM: AlertCircle,
  MENTION: MessageSquare,
  INVITATION: Mail,
  ACHIEVEMENT: Trophy,
  UPDATE: Bell,
  REMINDER: Calendar,
  ALERT: AlertCircle,
  MESSAGE: MessageSquare,
  FOLLOW: Users,
  STAR: Star,
  COMMENT: MessageSquare,
  ANNOUNCEMENT: Megaphone,
};

const COLOR_MAP: Record<string, string> = {
  SYSTEM: 'bg-blue-500/10 text-blue-500',
  MENTION: 'bg-purple-500/10 text-purple-500',
  INVITATION: 'bg-green-500/10 text-green-500',
  ACHIEVEMENT: 'bg-yellow-500/10 text-yellow-500',
  UPDATE: 'bg-blue-500/10 text-blue-500',
  REMINDER: 'bg-orange-500/10 text-orange-500',
  ALERT: 'bg-red-500/10 text-red-500',
  MESSAGE: 'bg-purple-500/10 text-purple-500',
  FOLLOW: 'bg-indigo-500/10 text-indigo-500',
  STAR: 'bg-yellow-500/10 text-yellow-500',
  COMMENT: 'bg-teal-500/10 text-teal-500',
  ANNOUNCEMENT: 'bg-pink-500/10 text-pink-500',
};

const getNotificationIcon = (type: string) => {
  const Icon = ICON_MAP[type] || Bell;
  return <Icon className="h-5 w-5" />;
};

const getNotificationColor = (type: string) => {
  return COLOR_MAP[type] || 'bg-gray-500/10 text-gray-500';
};

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('notificationSoundEnabled');
    return saved ? JSON.parse(saved) : false;
  });

  const queryClient = useQueryClient();
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  // SSE for real-time updates
  const { addEventListener, removeEventListener } = useStream();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Notification sound
  useEffect(() => {
    audioRef.current = new Audio('/sounds/notification.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  // Queries
  const getNotificationsFilter = () => {
    if (activeTab === 'unread') return 'unread';
    if (activeTab === 'read') return 'read';
    return undefined;
  };

  const { data: notificationsData, isLoading: loading } = useQuery({
    queryKey: ['notifications', activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      const filter = getNotificationsFilter();

      if (filter === 'unread') {
        params.append('read', 'false');
      } else if (filter === 'read') {
        params.append('read', 'true');
      }

      return apiRequest<{ data: { notifications: Notification[] } }>(
        `${API_BASE}/api/v1/notifications?${params}`
      );
    },
    staleTime: 30000, // 30 seconds
  });

  const notifications = notificationsData?.data?.notifications || [];

  const { data: unreadCountData } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: () => apiRequest<{ data: { count: number } }>(`${API_BASE}/api/v1/notifications/unread/count`),
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = unreadCountData?.data?.count || 0;

  // Removed manual fetch - handled by useQuery

  // SSE: Real-time new notification listener
  useEffect(() => {
    const handleNewNotification = (e: MessageEvent) => {
      try {
        const { notification } = JSON.parse(e.data);

        // Optimistically add to cache without refetching
        queryClient.setQueryData(['notifications', activeTab], (old: any) => {
          if (!old?.data?.notifications) return old;
          return {
            ...old,
            data: {
              notifications: [notification, ...old.data.notifications]
            }
          };
        });

        // Update unread count
        queryClient.setQueryData(['notifications', 'unreadCount'], (old: any) => {
          if (!old?.data?.count) return old;
          return {
            ...old,
            data: { count: old.data.count + 1 }
          };
        });

        // Play sound if enabled
        if (soundEnabled && audioRef.current) {
          if (navigator.vibrate){
            navigator.vibrate(50);
          }
          audioRef.current.play().catch(() => { });
        }

      } catch (error) {
        console.error('Failed to parse new notification event', error);
      }
    };

    addEventListener('inbox.notification.new', handleNewNotification);
    return () => removeEventListener('inbox.notification.new', handleNewNotification);
  }, [addEventListener, removeEventListener, soundEnabled, queryClient, activeTab]);

  // SSE: Real-time read status listener
  useEffect(() => {
    const handleReadUpdate = (e: MessageEvent) => {
      try {
        const { notificationId, count } = JSON.parse(e.data);

        // Optimistically update notification status
        if (notificationId) {
          queryClient.setQueryData(['notifications', activeTab], (old: any) => {
            if (!old?.data?.notifications) return old;
            return {
              ...old,
              data: {
                notifications: old.data.notifications.map((n: any) =>
                  n.id === notificationId ? { ...n, read: true } : n
                )
              }
            };
          });
        }

        // Update unread count
        queryClient.setQueryData(['notifications', 'unreadCount'], (old: any) => {
          if (!old?.data?.count) return old;
          return {
            ...old,
            data: { count: Math.max(0, old.data.count + count) }
          };
        });
      } catch (error) {
        console.error('Failed to parse read update event', error);
      }
    };

    addEventListener('inbox.notification.read', handleReadUpdate);
    return () => removeEventListener('inbox.notification.read', handleReadUpdate);
  }, [addEventListener, removeEventListener, queryClient, activeTab]);

  useEffect(() => {
    localStorage.setItem('notificationSoundEnabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  // Removed - activeTab changes trigger useQuery refetch via queryKey

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`${API_BASE}/api/v1/notifications/${notificationId}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Marked as read');
    },
    onError: () => {
      toast.error('Failed to mark as read');
    },
  });

  const markAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const markAsUnreadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`${API_BASE}/api/v1/notifications/${notificationId}/unread`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Marked as unread');
    },
    onError: () => {
      toast.error('Failed to mark as unread');
    },
  });

  const markAsUnread = (notificationId: string) => {
    markAsUnreadMutation.mutate(notificationId);
  };

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest(`${API_BASE}/api/v1/notifications/read/all`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
    onError: () => {
      toast.error('Failed to mark all as read');
    },
  });

  const markAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`${API_BASE}/api/v1/notifications/${notificationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification deleted');
    },
    onError: () => {
      toast.error('Failed to delete notification');
    },
  });

  const deleteNotification = (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId);
  };

  const deleteAllReadMutation = useMutation({
    mutationFn: () => apiRequest(`${API_BASE}/api/v1/notifications/read/all`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Read notifications deleted');
    },
    onError: () => {
      toast.error('Failed to delete read notifications');
    },
  });

  const deleteAllRead = () => {
    deleteAllReadMutation.mutate();
  };

  const filteredNotifications = notifications.filter((notification) => {
    const matchesSearch =
      (notification.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (notification.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (notification.message?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || notification.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setSelectedNotification(notification);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6" />
              <div>
                <h1 className="text-2xl font-bold">Inbox</h1>
                <p className="text-sm text-muted-foreground">
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                    : 'No unread notifications'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="gap-2"
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
                Sound
              </Button>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark all read
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Options
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-background border-border dark:bg-black/80 dark:border-white/20"
                >
                  <DropdownMenuItem onClick={deleteAllRead}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete all read
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b px-6 flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <TabsList className="bg-transparent h-12 p-0 justify-start w-auto">
              <TabsTrigger value="all" className="gap-2">
                All
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread" className="gap-2">
                Unread
                {unreadCount > 0 && (
                  <Badge variant="default" className="ml-1">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="read">Read</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-[300px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {NOTIFICATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              <TabsContent value="all" className="m-0">
                <NotificationList
                  notifications={filteredNotifications}
                  loading={loading}
                  onMarkAsRead={markAsRead}
                  onMarkAsUnread={markAsUnread}
                  onDelete={deleteNotification}
                  onClick={handleNotificationClick}
                />
              </TabsContent>

              <TabsContent value="unread" className="m-0">
                <NotificationList
                  notifications={filteredNotifications}
                  loading={loading}
                  onMarkAsRead={markAsRead}
                  onMarkAsUnread={markAsUnread}
                  onDelete={deleteNotification}
                  onClick={handleNotificationClick}
                />
              </TabsContent>

              <TabsContent value="read" className="m-0">
                <NotificationList
                  notifications={filteredNotifications}
                  loading={loading}
                  onMarkAsRead={markAsRead}
                  onMarkAsUnread={markAsUnread}
                  onDelete={deleteNotification}
                  onClick={handleNotificationClick}
                />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Notification Detail Modal */}
      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-xl pr-8">{selectedNotification?.title}</DialogTitle>
                <DialogDescription className="mt-2 text-sm">
                  {selectedNotification?.description}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedNotification(null)}
                className="h-8 w-8 absolute right-6 top-6"
              ></Button>
            </div>
          </DialogHeader>
          <div className="flex-1 px-6 py-4">
            {(() => {
              const message = selectedNotification?.message || '';
              const isHtml = /<[^>]*>/.test(message);

              if (isHtml) {
                // Allow <style> and inline styles so email templates keep their intended look,
                // but still strip dangerous tags/attributes. We keep scripts blocked via iframe sandbox.
                const sanitized = DOMPurify.sanitize(message, {
                  ALLOWED_TAGS: [
                    'p',
                    'br',
                    'strong',
                    'em',
                    'u',
                    'h1',
                    'h2',
                    'h3',
                    'h4',
                    'h5',
                    'h6',
                    'ul',
                    'ol',
                    'li',
                    'a',
                    'blockquote',
                    'code',
                    'pre',
                    'span',
                    'div',
                    'img',
                    'table',
                    'thead',
                    'tbody',
                    'tr',
                    'th',
                    'td',
                    'style',
                  ],
                  ALLOWED_ATTR: [
                    'href',
                    'target',
                    'rel',
                    'src',
                    'alt',
                    'title',
                    'style',
                    'colspan',
                    'rowspan',
                    'width',
                    'height',
                    'align',
                    'valign',
                    'bgcolor',
                    'border',
                  ],
                  FORBID_TAGS: [
                    'script',
                    'iframe',
                    'form',
                    'input',
                    'button',
                    'select',
                    'textarea',
                    'object',
                    'embed',
                  ],
                  FORBID_ATTR: ['on*'],
                  ALLOW_DATA_ATTR: false,
                });

                // Build a Gmail-like wrapper: centered white card, subtle shadow, consistent fonts/colors.
                // We purposely keep iframe sandbox empty (no allow-scripts) so scripts are blocked.
                const wrapperHtml = `<!doctype html><html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<base target="_blank" />
<style>
  html,body { height:100%; }
  body { margin:0; padding:18px; -webkit-font-smoothing:antialiased; font-family: Arial, Helvetica, sans-serif; background:#f1f3f4; }
  .gmail-card { max-width:760px; margin:0 auto; background:#ffffff; border-radius:6px; box-shadow:0 1px 0 rgba(0,0,0,0.12); overflow:hidden; }
  .gmail-content { padding:28px; color:#202124; font-size:14px; line-height:1.45; }
  .gmail-hero h1 { font-size:22px; margin:0 0 14px; color:#202124; }
  a { color:#1a73e8; }
  img { max-width:100%; height:auto; display:block; }
  table { border-collapse:collapse; width:100%; }
  td,th { padding:0; }
  .gmail-cta { display:inline-block; background:#1a73e8; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none; }
  /* Preserve inline styles given by email templates; the sanitized content will be placed inside .gmail-content */
</style>
</head><body>
  <div class="gmail-card"><div class="gmail-content">${sanitized}</div></div>
</body></html>`;

                return (
                  <iframe
                    srcDoc={wrapperHtml}
                    className="w-full h-full border-0 rounded-md"
                    sandbox=""
                    title="Notification content"
                  />
                );
              } else {
                return <div className="whitespace-pre-wrap text-sm leading-relaxed">{message}</div>;
              }
            })()}
          </div>{' '}
          {selectedNotification?.actionUrl && selectedNotification?.actionLabel && (
            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/20">
              <Button variant="outline" onClick={() => setSelectedNotification(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  if (selectedNotification?.actionUrl) {
                    window.location.href = selectedNotification.actionUrl;
                  }
                }}
              >
                {selectedNotification.actionLabel}
                <ArrowUpRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notification: Notification) => void;
}

function NotificationList({
  notifications,
  loading,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  onClick,
}: NotificationListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No notifications</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          When you receive notifications, they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <Card
          key={notification.id}
          className={cn(
            'p-4 transition-all hover:shadow-md cursor-pointer',
            !notification.read && 'bg-primary/5 border-primary/20',
          )}
          onClick={() => onClick(notification)}
        >
          <div className="flex gap-4">
            {/* Icon */}
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                getNotificationColor(notification.type),
              )}
            >
              {getNotificationIcon(notification.type)}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{notification.title}</h4>
                    {!notification.read && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {notification.description}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background">
                    {!notification.read ? (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAsRead(notification.id);
                        }}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Mark as read
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAsUnread(notification.id);
                        }}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Mark as unread
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(notification.id);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Action Button */}
              {notification.actionUrl && notification.actionLabel && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick(notification);
                  }}
                >
                  {notification.actionLabel}
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              )}

              {/* Timestamp */}
              <p className="text-xs text-muted-foreground">
                {formatTimeAgo(notification.createdAt)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
