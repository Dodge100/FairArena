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
import { useTheme } from '@/hooks/useTheme';
import { useClerk, useUser } from '@clerk/clerk-react';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
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
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Menu items
const menuItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: Home,
  },
  {
    title: 'Projects',
    url: '/dashboard/projects',
    icon: FileText,
    items: [
      {
        title: 'All Projects',
        url: '/dashboard/projects/all',
      },
      {
        title: 'Active',
        url: '/dashboard/projects/active',
      },
      {
        title: 'Completed',
        url: '/dashboard/projects/completed',
      },
    ],
  },
  {
    title: 'Hackathons',
    url: '/dashboard/hackathons',
    icon: Trophy,
  },
  {
    title: 'Analytics',
    url: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    title: 'Team',
    url: '/dashboard/team',
    icon: Users,
  },
  {
    title: 'Inbox',
    url: '/dashboard/inbox',
    icon: Inbox,
    badge: '3',
  },
];

const secondaryItems = [
  {
    title: 'Search',
    url: '/dashboard/search',
    icon: Search,
  },
  {
    title: 'Calendar',
    url: '/dashboard/calendar',
    icon: Calendar,
  },
  {
    title: 'Settings',
    url: '/dashboard/account-settings',
    icon: Settings,
  },
  {
    title: 'Help & Support',
    url: '/support',
    icon: HelpCircle,
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { theme, toggleTheme } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

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
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-r from-[#DDFF00] to-[#9AC400]">
            <Trophy className="h-5 w-5 text-neutral-900" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">FairArena</span>
            <span className="text-xs text-muted-foreground">Hackathon Platform</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar scrollbar-hide">
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
              {secondaryItems.map((item) => (
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
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="h-auto py-2 cursor-pointer w-full"
              tooltip="Profile"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <Avatar className="h-8 w-8 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6 shrink-0">
                    <AvatarImage src={user?.imageUrl} alt={user?.fullName || 'User'} />
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
                      {user?.primaryEmailAddress?.emailAddress}
                    </span>
                  </div>
                </div>
                {profileMenuOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </div>
            </SidebarMenuButton>
            {profileMenuOpen && (
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    onClick={() => {
                      navigate('/dashboard/profile');
                      setProfileMenuOpen(false);
                    }}
                    className="cursor-pointer"
                    isActive={location.pathname === '/dashboard/profile'}
                  >
                    <span>Main Profile</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    onClick={() => {
                      navigate('/dashboard/public-profile');
                      setProfileMenuOpen(false);
                    }}
                    className="cursor-pointer"
                    isActive={location.pathname === '/dashboard/public-profile'}
                  >
                    <span>My Profile</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            )}
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
