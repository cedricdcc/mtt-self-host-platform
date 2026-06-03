import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load the Spline component to avoid blocking the initial bundle
const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneProps {
  scene: string;
  fallbackImage?: string;
  className?: string;
  minHeight?: string;
  onLoad?: (app: any) => void;
}

export const SplineScene: React.FC<SplineSceneProps> = ({ scene, fallbackImage, className, minHeight, onLoad }) => {
  const [loaded, setLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle graceful degradation for mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add listener for window resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // If mobile and a fallback image is provided, show that instead for performance
  if (isMobile && fallbackImage) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className || ''}`}>
        <img 
          src={fallbackImage} 
          alt="3D Scene Fallback" 
          className="max-w-full max-h-full object-contain pointer-events-none"
        />
      </div>
    );
  }

  // If mobile but no fallback image is provided, we might want to just hide it
  // or return null. For now, we'll try to render it but it might be slow.
  // In a robust app, we might return null here to save battery/data on mobile.
  if (isMobile && !fallbackImage) {
      // return null; // Uncomment to completely disable on mobile without a fallback
      // For now, we'll render it but acknowledge it might be heavy.
  }

  return (
    <div className={`relative w-full h-full ${minHeight || 'min-h-[300px]'} ${className || ''}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent z-10">
          <Loader2 size={32} className="animate-spin text-marine-400 opacity-70" />
        </div>
      )}
      
      <Suspense fallback={null}>
        <div 
          className="absolute inset-0 transition-opacity duration-1000" 
          style={{ opacity: loaded ? 1 : 0 }}
        >
          <Spline 
            scene={scene} 
            onLoad={(app) => {
              setLoaded(true);
              if (onLoad) onLoad(app);
            }}
          />
        </div>
      </Suspense>
    </div>
  );
};

export default SplineScene;
