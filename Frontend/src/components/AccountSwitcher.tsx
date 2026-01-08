import {
    Check,
    ChevronsUpDown,
    LogOut,
    Plus
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

export function AccountSwitcher() {
    const { isMobile } = useSidebar();
    const {
        user,
        accounts,
        activeSessionId,
        logout,
        logoutAllAccounts,
        switchAccount,
        maxAccounts
    } = useAuth();
    const navigate = useNavigate();

    // If no user, don't render anything (shouldn't happen in authenticated layout)
    if (!user) return null;

    const handleAddAccount = () => {
        // Navigate to signin with special flow param
        // We use window.location to ensure a full reload/clear of certain transient states if needed,
        // but react-router navigate is better for SPA.
        // However, we need to make sure we don't auto-redirect back.
        navigate("/signin?flow=add_account");
    };

    const currentAccount = accounts.find(a => a.sessionId === activeSessionId) || {
        sessionId: 'current',
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
    };

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarImage src={user.profileImageUrl || ''} alt={user.firstName || ''} />
                                <AvatarFallback className="rounded-lg">{user.firstName?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{user.firstName} {user.lastName}</span>
                                <span className="truncate text-xs">{user.email}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Switch Account
                        </DropdownMenuLabel>
                        <DropdownMenuGroup>
                            {accounts.map((account) => (
                                <DropdownMenuItem
                                    key={account.sessionId}
                                    onClick={() => switchAccount(account.sessionId)}
                                    className="gap-2 p-2"
                                    disabled={account.sessionId === activeSessionId}
                                >
                                    <Avatar className="h-6 w-6 rounded-lg border">
                                        <AvatarImage src={account.profileImageUrl || ''} alt={account.firstName || ''} />
                                        <AvatarFallback className="rounded-lg">{account.firstName?.[0] || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col flex-1 gap-1">
                                        <span className="text-sm font-medium leading-none truncate">{account.firstName} {account.lastName}</span>
                                        <span className="text-xs text-muted-foreground truncate">{account.email}</span>
                                    </div>
                                    {account.sessionId === activeSessionId && (
                                        <Check className="ml-auto size-4" />
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>

                        {accounts.length < maxAccounts && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleAddAccount} className="gap-2 cursor-pointer">
                                    <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                                        <Plus className="size-4" />
                                    </div>
                                    <div className="font-medium text-muted-foreground">Add account</div>
                                </DropdownMenuItem>
                            </>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => logout()} className="gap-2 cursor-pointer text-red-500 focus:text-red-500">
                            <LogOut className="size-4" />
                            Log out
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => logoutAllAccounts()} className="gap-2 cursor-pointer text-red-500 focus:text-red-500">
                            <LogOut className="size-4" />
                            Log out all accounts
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
