import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@clerk/clerk-react';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

function InviteFriend() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [email, setEmail] = useState('');
  const { isSignedIn, getToken } = useAuth();

  if (!isSignedIn) {
    return null;
  }

  const handleEmailInvite = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/platform/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await getToken()) || ''}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message || 'Invitation sent successfully!');
        setEmail('');
      } else {
        toast.error(data.message || 'Failed to send invitation. Please try again.');
      }
    } catch (error) {
      console.error('Invite error:', error);
      toast.error('Something went wrong. Please try again later.');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
        Invite Friends
      </h3>

      {/* Email Invite */}
      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEmailInvite();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className={`
              flex-1 px-3 py-2 text-sm rounded-lg outline-none transition
              ${
                isDark
                  ? 'bg-neutral-800 text-white placeholder-neutral-500 border border-neutral-700 focus:border-[#DDFF00]'
                  : 'bg-white text-black placeholder-neutral-500 border border-neutral-300 focus:border-[#556000]'
              }
            `}
          />
          <button
            type="submit"
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition
              flex items-center gap-2 whitespace-nowrap
              ${
                isDark
                  ? 'bg-[#DDFF00] text-black hover:bg-[#DDFF00]/80'
                  : 'bg-[#556000] text-white hover:bg-[#8aa300]'
              }
            `}
          >
            <Mail className="w-4 h-4" />
            Send Invite
          </button>
        </form>
      </div>
    </div>
  );
}

export default InviteFriend;
