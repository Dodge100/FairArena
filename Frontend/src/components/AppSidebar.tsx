import { AccountSwitcher } from '@/components/AccountSwitcher';
import { ThemeSwitcher } from '@/components/kibo-ui/theme-switcher';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar
} from '@/components/ui/sidebar';
import { useDataSaver } from '@/contexts/DataSaverContext';
import { useSidebarCustomization } from '@/contexts/SidebarCustomizationContext';
import { useSocket } from '@/contexts/SocketContext';
import { formatLastUpdated, useGitHubLastUpdated } from '@/hooks/useGitHubLastUpdated';
import { useTheme } from '@/hooks/useTheme';
import { apiRequest } from '@/lib/apiClient';
import { useAuthState } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Calendar,

  CreditCard,
  FileText,
  HelpCircle,
  Home,
  Inbox,
  Search,
  Settings,
  Shield,
  Trophy,
  UserCircle,
  Users
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface WindowWithWebkit extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const playSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded } = useAuthState();
  const { theme, setTheme } = useTheme();
  const { dataSaverSettings } = useDataSaver();
  const { customization } = useSidebarCustomization();

  const queryClient = useQueryClient();

  const [soundEnabled] = useState(() => {
    const saved = localStorage.getItem('notificationSoundEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const previousUnreadCountRef = useRef(0);
  const { socket } = useSocket();

  useEffect(() => {
    localStorage.setItem('notificationSoundEnabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiRequest<{ data: { count: number } }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/notifications/unread/count`),
    enabled: isLoaded && !(dataSaverSettings.enabled && dataSaverSettings.disableNotifications),
    staleTime: 60000,
  });

  const unreadCount = unreadData?.data?.count || 0;

  // Fetch GitHub last updated
  const { data: githubData } = useGitHubLastUpdated();

  // Sound effect
  useEffect(() => {
    // Skip sound on initial load or if count didn't increase
    if (!isInitialLoad && soundEnabled && unreadCount > previousUnreadCountRef.current) {
      playSound();
    }

    if (unreadData && isInitialLoad) {
      setIsInitialLoad(false);
    }

    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount, soundEnabled, isInitialLoad, unreadData]);


  // Set up socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: { count: number }) => {
      queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => {
        const current = old?.data?.count || 0;
        return { data: { count: current + data.count } };
      });
    };

    const handleReadNotification = (data: { count: number }) => {
      queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => {
        const current = old?.data?.count || 0;
        return { data: { count: Math.max(0, current + data.count) } }; // payload usually negative or we subtract? Handlers usually send delta.
        // Existing code: setUnreadCount(prev => Math.max(0, prev + data.count));
        // If data.count is negative (e.g. -1), it adds.
      });
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read', handleReadNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read', handleReadNotification);
    };
  }, [socket, queryClient]);

  const { setOpen, state } = useSidebar();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setOpen(true);
        // Small timeout to allow expansion and mount
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  // Menu items - defined inside component to access unreadCount and customization
  const rawMenuItems = customization.mainItems
    .filter(item => item.visible)
    .sort((a, b) => a.order - b.order)
    .map(item => {
      // Map icon strings to actual icon components
      const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
        Home,
        FileText,
        Trophy,
        BarChart3,
        Users,
        CreditCard,
        Inbox,
        UserCircle,
        Shield,
      };

      return {
        ...item,
        icon: iconMap[item.icon] || Home,
        badge: item.id === 'inbox' && !(dataSaverSettings.enabled && dataSaverSettings.disableNotifications) && unreadCount > 0
          ? unreadCount.toString()
          : undefined,
      };
    });

  const menuItems = rawMenuItems.map(item => {
    if (!searchQuery) return item;
    const matchParent = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const filteredChildren = item.items?.filter(sub => sub.title.toLowerCase().includes(searchQuery.toLowerCase())) || [];

    if (matchParent) return item; // Showing all children if parent matches
    if (filteredChildren.length > 0) {
      return { ...item, items: filteredChildren };
    }
    return null;
  }).filter((item): item is typeof rawMenuItems[0] => item !== null);

  const rawSecondaryMenuItems = customization.secondaryItems
    .filter(item => item.visible)
    .sort((a, b) => a.order - b.order)
    .map(item => {
      const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
        Search,
        Calendar,
        Settings,
        HelpCircle,
      };

      return {
        ...item,
        icon: iconMap[item.icon] || Settings,
      };
    });

  const secondaryMenuItems = rawSecondaryMenuItems.map(item => {
    // We handle Search separately at the top, so filter it out here
    if (item.title === 'Search') return null;

    if (!searchQuery) return item;
    return item.title.toLowerCase().includes(searchQuery.toLowerCase()) ? item : null;
  }).filter((item): item is typeof rawSecondaryMenuItems[0] => item !== null);



  return (
    <Sidebar collapsible="icon" className="border-r bg-sidebar">
      <SidebarHeader className="border-b px-4 py-3 bg-sidebar group-data-[collapsible=icon]:px-1">
        <Link to="/">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            {/* Show logo and text when expanded */}
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <img
                src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
                className="w-30 -my-8"
                alt="FairArena Logo"
                style={{ filter: theme === 'light' ? 'invert(1)' : 'none' }}
              />
              {/* <span className="text-sm font-semibold">FairArena</span> */}
              <span className="text-xs text-muted-foreground">Hackathon Platform</span>
            </div>
            {/* Show trophy icon when collapsed */}
            <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
              <Trophy className="h-7 w-7 text-primary" />
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar scrollbar-hide group-data-[collapsible=icon]:scrollbar-default group-data-[collapsible=icon]:overflow-y-auto">
        <SidebarGroup className="py-2">
          <SidebarMenu>
            <SidebarMenuItem>
              {state === 'collapsed' ? (
                <SidebarMenuButton
                  onClick={() => setOpen(true)}
                  tooltip="Search (Ctrl + C)"
                >
                  <Search className="h-4 w-4" />
                  <span>Search</span>
                </SidebarMenuButton>
              ) : (
                <div className="relative px-2 group-data-[collapsible=icon]:px-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <SidebarInput
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="pl-9 h-9 bg-background/50 border-input focus:bg-background transition-colors"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none text-muted-foreground">
                    <kbd className="h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 flex">
                      <span className="text-xs">⌘</span>C
                    </kbd>
                  </div>
                </div>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    {item.badge && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                  {item.items && item.items.length > 0 && (
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            onClick={() => navigate(subItem.url)}
                            isActive={location.pathname === subItem.url}
                          >
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t bg-sidebar">
        <AccountSwitcher />
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 py-2">
              <ThemeSwitcher
                value={theme}
                onChange={setTheme}
                className="justify-center group-data-[collapsible=icon]:hidden"
              />
            </div>
          </SidebarMenuItem>
          {githubData?.data?.lastUpdated && (
            <SidebarMenuItem>
              <div className="px-2 py-0.5 group-data-[collapsible=icon]:px-1 text-[10px] text-muted-foreground text-center">
                <span className="group-data-[collapsible=icon]:hidden">
                  Last updated: {formatLastUpdated(githubData.data.lastUpdated)}
                </span>
                <span className="hidden group-data-[collapsible=icon]:inline-block">
                  {formatLastUpdated(githubData.data.lastUpdated)}
                </span>
              </div>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
