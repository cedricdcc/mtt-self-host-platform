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

  const hasAccess = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.hasGachaAccess);

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="p-4 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-full mb-4">
          <Waves size={48} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Oceanarium Access Restricted</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
          The Oceanarium and Gacha Expedition are currently in private preview. Contact an administrator to request access.
        </p>
        <Navigate to="/dashboard" replace />
      </div>
    );
  }

  return <>{children}</>;
};

export default OceanariumRoute;
