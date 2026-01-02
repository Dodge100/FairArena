import { ThemeSwitcher } from '@/components/kibo-ui/theme-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useDataSaver } from '@/contexts/DataSaverContext';
import { useSidebarCustomization } from '@/contexts/SidebarCustomizationContext';
import { useSocket } from '@/contexts/SocketContext';
import { useTheme } from '@/hooks/useTheme';
import { useAuthState } from '@/lib/auth';
import {
  BarChart3,
  Calendar,

  CreditCard,
  FileText,
  HelpCircle,
  Home,
  Inbox,
  LogOut,
  Search,
  Settings,
  Trophy,
  Users,
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
  const { user, getToken, signOut, isLoaded } = useAuthState();
  const { theme, toggleTheme } = useTheme();
  const { dataSaverSettings } = useDataSaver();
  const { customization } = useSidebarCustomization();

  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('notificationSoundEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const previousUnreadCountRef = useRef(0);

  const { socket } = useSocket();

  useEffect(() => {
    localStorage.setItem('notificationSoundEnabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  // Fetch initial unread notification count and set up socket listeners
  useEffect(() => {
    if (!isLoaded || (dataSaverSettings.enabled && dataSaverSettings.disableNotifications)) return;

    const fetchUnreadCount = async () => {
      try {
        const token = await getToken();
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/notifications/unread/count`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
          },
        );

        if (response.ok) {
          const data = await response.json();
          const current = data.data.count;
          setUnreadCount(current);
          if (!isInitialLoad && soundEnabled && current > previousUnreadCountRef.current) {
            playSound();
          }
          if (isInitialLoad) {
            setIsInitialLoad(false);
          }
          previousUnreadCountRef.current = current;
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    // Fetch initial count
    fetchUnreadCount();

    // Set up socket listeners for real-time updates
    if (socket) {
      const handleNewNotification = (data: { count: number }) => {
        setUnreadCount(prev => {
          const newCount = prev + data.count;
          if (soundEnabled && newCount > prev) {
            playSound();
          }
          return newCount;
        });
      };

      const handleReadNotification = (data: { count: number }) => {
        setUnreadCount(prev => Math.max(0, prev + data.count));
      };

      socket.on('notification:new', handleNewNotification);
      socket.on('notification:read', handleReadNotification);

      return () => {
        socket.off('notification:new', handleNewNotification);
        socket.off('notification:read', handleReadNotification);
      };
    }
  }, [getToken, dataSaverSettings, isLoaded, isInitialLoad, soundEnabled, socket]);

  // Menu items - defined inside component to access unreadCount and customization
  const menuItems = customization.mainItems
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
      };

      return {
        ...item,
        icon: iconMap[item.icon] || Home,
        badge: item.id === 'inbox' && !(dataSaverSettings.enabled && dataSaverSettings.disableNotifications) && unreadCount > 0
          ? unreadCount.toString()
          : undefined,
      };
    });

  const secondaryMenuItems = customization.secondaryItems
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.firstName?.[0]?.toUpperCase() || 'U';
  };

  return (
    <Sidebar collapsible="icon" className="border-r bg-sidebar">
      <SidebarHeader className="border-b px-4 py-3 bg-sidebar group-data-[collapsible=icon]:px-1">
        <Link to="/">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            {/* Show logo and text when expanded */}
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <img
                src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png"
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate('/dashboard/public-profile')}
              className="h-auto py-2 cursor-pointer w-full"
              isActive={location.pathname === '/dashboard/public-profile'}
              tooltip="Profile"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <Avatar className="h-8 w-8 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6 shrink-0">
                    <AvatarImage src={user?.profileImageUrl ?? undefined} alt={user?.fullName || 'User'} />
                    <AvatarFallback
                      className={`bg-primary text-primary-foreground ${theme === 'dark' ? 'bg-primary/20 text-primary-foreground' : ''}`}
                    >
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start overflow-hidden flex-1 min-w-0">
                    <span className="text-sm font-medium truncate w-full">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {user?.email}
                    </span>
                  </div>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="px-2 py-2">
              <ThemeSwitcher
                value={theme}
                onChange={(newTheme) => {
                  if (theme !== newTheme) {
                    toggleTheme();
                  }
                }}
                className="justify-center group-data-[collapsible=icon]:hidden"
              />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out">
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
