import { UserProfile } from '@clerk/clerk-react'
import { useTheme } from '@/hooks/useTheme'

function Profile() {
  const { theme } = useTheme()

  return (
    <UserProfile
      appearance={{
        elements: {
          rootBox: "w-full",
          card: "bg-card border-border shadow-lg",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          profileSectionTitle: "text-foreground font-semibold",
          profileSectionTitleText: "text-foreground",
          profileSectionContent: "text-foreground",
          formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
          formButtonReset: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
          formFieldInput: "bg-background border-border text-foreground placeholder:text-muted-foreground",
          formFieldLabel: "text-foreground",
          formFieldHintText: "text-muted-foreground",
          navbarButton: "text-muted-foreground hover:text-foreground",
          navbarMobileMenuButton: "text-muted-foreground hover:text-foreground",
          pageScrollBox: "bg-background",
          page: "bg-background",
          alert: "bg-destructive/10 border-destructive/20 text-destructive",
          alertText: "text-destructive",
          badge: "bg-secondary text-secondary-foreground",
          button: "bg-primary hover:bg-primary/90 text-primary-foreground",
          dividerLine: "bg-border",
          dividerText: "text-muted-foreground",
          footer: "bg-background border-t border-border",
          footerActionLink: "text-primary hover:text-primary/80",
          identityPreview: "bg-muted",
          identityPreviewText: "text-foreground",
          identityPreviewEditButton: "text-muted-foreground hover:text-foreground",
          otpCodeField: "bg-background border-border text-foreground",
          phoneNumberField: "bg-background border-border text-foreground",
          profileSection: "border-border",
          scrollBox: "bg-background",
          selectButton: "bg-background border-border text-foreground hover:bg-accent",
          selectButtonIcon: "text-muted-foreground",
          selectOptions: "bg-popover border-border",
          selectOption: "text-foreground hover:bg-accent",
          socialButtonsBlockButton: "bg-background border-border text-foreground hover:bg-accent",
          socialButtonsBlockButtonText: "text-foreground",
          socialButtonsBlockButtonArrow: "text-muted-foreground",
          table: "text-foreground",
          tableHead: "text-foreground font-semibold",
          tableBody: "text-foreground",
          tableRow: "border-border hover:bg-muted/50",
          userButtonPopoverCard: "bg-popover border-border",
          userButtonPopoverActionButton: "text-foreground hover:bg-accent",
          userButtonPopoverActionButtonText: "text-foreground",
          userButtonPopoverActionButtonIcon: "text-muted-foreground",
          userPreview: "bg-muted",
          userPreviewAvatarBox: "bg-primary text-primary-foreground",
          userPreviewAvatarImage: "object-cover",
          userPreviewSecondaryIdentifier: "text-muted-foreground",
          userPreviewMainIdentifier: "text-foreground",
          userButtonTrigger: "bg-background border-border text-foreground hover:bg-accent",
          userButtonAvatarBox: "bg-primary text-primary-foreground",
          userButtonAvatarImage: "object-cover",
        },
        variables: {
          colorPrimary: theme === 'dark' ? 'hsl(var(--primary))' : 'hsl(var(--primary))',
          colorBackground: theme === 'dark' ? 'hsl(var(--background))' : 'hsl(var(--background))',
          colorInputBackground: theme === 'dark' ? 'hsl(var(--background))' : 'hsl(var(--background))',
          colorInputText: theme === 'dark' ? 'hsl(var(--foreground))' : 'hsl(var(--foreground))',
          colorText: theme === 'dark' ? 'hsl(var(--foreground))' : 'hsl(var(--foreground))',
          colorTextSecondary: theme === 'dark' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground))',
          borderRadius: '0.5rem',
        }
      }}
    />
  )
}

export default Profile
