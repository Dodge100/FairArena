import { useUser } from '@clerk/clerk-react';
import { useTheme } from '../hooks/useTheme';

function Dashboard() {
  const { user } = useUser();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen py-16 px-4 ${isDark ? 'bg-neutral-900 text-white' : 'bg-white text-black'}`}
    >
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-12">
          Welcome to your{' '}
          <span className="bg-linear-to-r from-[#DDFF00] to-[#9AC400] bg-clip-text text-transparent">
            Dashboard
          </span>
        </h1>

        {user && (
          <div className={`p-6 rounded-lg ${isDark ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
            <h2 className="text-2xl font-semibold mb-4">User Information</h2>
            <div className="space-y-2">
              <p>
                <strong>Name:</strong> {user.firstName} {user.lastName}
              </p>
              <p>
                <strong>Email:</strong> {user.primaryEmailAddress?.emailAddress}
              </p>
              <p>
                <strong>User ID:</strong> {user.id}
              </p>
            </div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-6 rounded-lg ${isDark ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
            <h3 className="text-xl font-semibold mb-4">Your Projects</h3>
            <p className="text-neutral-600 dark:text-neutral-400">
              Manage your hackathon projects and submissions here.
            </p>
          </div>

          <div className={`p-6 rounded-lg ${isDark ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
            <h3 className="text-xl font-semibold mb-4">Analytics</h3>
            <p className="text-neutral-600 dark:text-neutral-400">
              View insights and performance metrics.
            </p>
          </div>

          <div className={`p-6 rounded-lg ${isDark ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
            <h3 className="text-xl font-semibold mb-4">Settings</h3>
            <p className="text-neutral-600 dark:text-neutral-400">
              Customize your account preferences.
            </p>
          </div>

          <div className={`p-6 rounded-lg ${isDark ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
            <h3 className="text-xl font-semibold mb-4">Support</h3>
            <p className="text-neutral-600 dark:text-neutral-400">Get help and contact support.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
