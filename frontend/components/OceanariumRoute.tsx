import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Waves } from 'lucide-react';

interface OceanariumRouteProps {
  children: React.ReactNode;
}

const OceanariumRoute: React.FC<OceanariumRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // All authenticated users can access the Oceanarium / Codex experience.
  // The 3D Aquarium tab is managed adaptively per device and permissions within the page.
  return <>{children}</>;
};

export default OceanariumRoute;
