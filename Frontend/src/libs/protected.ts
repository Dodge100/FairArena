import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export function Protected({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser();
  const navigate = useNavigate();

  if (!isSignedIn) {
    navigate('/signin');
    return null;
  }

  return children;
}
