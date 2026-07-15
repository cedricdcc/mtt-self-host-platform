import React from 'react';

interface AchievementIconProps {
  id: string;
  tier: number; // 1 = Bronze, 2 = Silver, 3 = Gold
  unlocked: boolean;
  className?: string;
  size?: number;
}

export const AchievementIcon: React.FC<AchievementIconProps> = ({
  id,
  tier,
  unlocked,
  className = '',
  size = 64
}) => {
  // Metallic filters based on tier
  const getFilterStyle = (): React.CSSProperties => {
    if (!unlocked) {
      return { filter: 'grayscale(1) opacity(0.25)' };
    }
    switch (tier) {
      case 1: // Bronze
        return { filter: 'sepia(0.6) hue-rotate(-15deg) saturate(1.8) contrast(1.1) brightness(0.9)' };
      case 2: // Silver
        return { filter: 'grayscale(1) brightness(1.2) contrast(1.1)' };
      case 3: // Gold
        return { filter: 'sepia(0.7) hue-rotate(15deg) saturate(2.5) contrast(1.2) brightness(1.1) drop-shadow(0 0 6px rgba(234, 179, 8, 0.5))' };
      default:
        return {};
    }
  };

  const style = getFilterStyle();

  // Custom inline SVGs for minimalistic creatures with big cute cartoon eyes and smiles
  const renderIconContent = () => {
    switch (id) {
      case 'streak_puffer':
        // Uses the original puffer.png
        return (
          <img
            src="/puffer.png"
            alt="Pufferfish"
            style={{ width: size, height: size, objectFit: 'contain', ...style }}
            className={`transition-all duration-300 ${className}`}
          />
        );

      case 'translation_angler':
        // Anglerfish
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" style={style} className={`transition-all duration-300 ${className}`}>
            <defs>
              <linearGradient id="anglerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            {/* Angler light */}
            <path d="M 50,30 Q 30,10 40,8" fill="none" stroke="#fbbf24" strokeWidth="3" />
            <circle cx="40" cy="8" r="5" fill="#fef08a" filter="drop-shadow(0 0 4px #fbbf24)" />
            {/* Body */}
            <circle cx="55" cy="55" r="30" fill="url(#anglerGrad)" />
            {/* Eyes (big cartoon eyes) */}
            <circle cx="65" cy="45" r="8" fill="white" />
            <circle cx="65" cy="45" r="4" fill="#1e293b" />
            <circle cx="67" cy="43" r="1.5" fill="white" /> {/* Reflection */}
            {/* Smile */}
            <path d="M 55,65 Q 65,70 70,62" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
            {/* Back Fin */}
            <path d="M 25,55 L 12,45 L 18,55 L 12,65 Z" fill="#ec4899" />
            {/* Top Fin */}
            <path d="M 45,26 Q 55,20 65,26 L 55,32 Z" fill="#4f46e5" />
          </svg>
        );

      case 'review_turtle':
        // Sea Turtle
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" style={style} className={`transition-all duration-300 ${className}`}>
            <defs>
              <linearGradient id="turtleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            {/* Flippers */}
            <ellipse cx="30" cy="40" rx="14" ry="6" fill="#047857" transform="rotate(-30 30 40)" />
            <ellipse cx="70" cy="40" rx="14" ry="6" fill="#047857" transform="rotate(30 70 40)" />
            <ellipse cx="32" cy="70" rx="10" ry="5" fill="#047857" transform="rotate(20 32 70)" />
            <ellipse cx="68" cy="70" rx="10" ry="5" fill="#047857" transform="rotate(-20 68 70)" />
            {/* Shell */}
            <ellipse cx="50" cy="55" rx="26" ry="22" fill="url(#turtleGrad)" />
            <ellipse cx="50" cy="55" rx="20" ry="16" fill="none" stroke="#065f46" strokeWidth="2" />
            {/* Head */}
            <circle cx="50" cy="24" r="12" fill="#10b981" />
            {/* Eyes */}
            <circle cx="46" cy="21" r="2.5" fill="white" />
            <circle cx="46" cy="21" r="1.2" fill="#1e293b" />
            <circle cx="54" cy="21" r="2.5" fill="white" />
            <circle cx="54" cy="21" r="1.2" fill="#1e293b" />
            {/* Smile */}
            <path d="M 47,28 Q 50,31 53,28" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
            {/* Tail */}
            <path d="M 50,77 L 47,84 L 53,84 Z" fill="#047857" />
          </svg>
        );

      case 'discussion_dolphin':
        // Dolphin
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" style={style} className={`transition-all duration-300 ${className}`}>
            <defs>
              <linearGradient id="dolphinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            {/* Body curved tail */}
            <path d="M 30,70 Q 20,60 15,45 Q 18,35 28,30 Q 55,25 75,45 Q 85,55 78,65 Q 70,68 62,60 Q 45,45 35,58 T 30,70" fill="url(#dolphinGrad)" />
            {/* Snout */}
            <path d="M 72,43 C 78,41 84,45 82,49 C 78,52 74,48 72,43" fill="#0ea5e9" />
            {/* Flippers */}
            <path d="M 50,45 Q 52,58 45,62 Q 42,52 50,45" fill="#2563eb" />
            <path d="M 54,30 Q 52,18 58,15 Q 60,25 54,30" fill="#0ea5e9" /> {/* Dorsal fin */}
            <path d="M 16,45 L 6,40 L 10,48 L 5,55 Z" fill="#2563eb" /> {/* Tail fin */}
            {/* Eyes */}
            <circle cx="66" cy="40" r="3.5" fill="white" />
            <circle cx="66" cy="40" r="1.7" fill="#1e293b" />
            {/* Smile */}
            <path d="M 70,47 Q 74,50 77,46" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );

      case 'reputation_stingray':
        // Stingray
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" style={style} className={`transition-all duration-300 ${className}`}>
            <defs>
              <linearGradient id="stingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
            </defs>
            {/* Tail */}
            <path d="M 50,55 Q 50,85 55,90" fill="none" stroke="#6d28d9" strokeWidth="3" strokeLinecap="round" />
            {/* Wings / Body */}
            <path d="M 50,20 C 65,22 88,38 88,44 C 88,50 68,52 50,55 C 32,52 12,50 12,44 C 12,38 35,22 50,20 Z" fill="url(#stingGrad)" />
            {/* Eyes (situated on top of head) */}
            <circle cx="42" cy="28" r="3" fill="white" />
            <circle cx="42" cy="28" r="1.5" fill="#1e293b" />
            <circle cx="58" cy="28" r="3" fill="white" />
            <circle cx="58" cy="28" r="1.5" fill="#1e293b" />
            {/* Cute Smile */}
            <path d="M 47,34 Q 50,37 53,34" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );

      case 'goal_seahorse':
        // Seahorse
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" style={style} className={`transition-all duration-300 ${className}`}>
            <defs>
              <linearGradient id="seahorseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            {/* Head & Body */}
            <path d="M 55,20 C 55,10 40,12 40,22 C 40,28 48,30 46,38 C 44,46 36,48 38,58 C 40,68 50,66 48,74 C 46,80 38,78 40,84 C 42,90 52,86 52,80 C 52,70 44,70 46,58 C 48,48 56,46 54,36 C 52,30 55,26 55,20 Z" fill="url(#seahorseGrad)" />
            {/* Snout */}
            <path d="M 40,20 L 30,22 L 30,25 L 40,24 Z" fill="#d97706" />
            {/* Fins */}
            <path d="M 54,42 Q 62,40 60,48 Q 52,48 54,42" fill="#f59e0b" />
            {/* Eyes */}
            <circle cx="47" cy="18" r="3" fill="white" />
            <circle cx="47" cy="18" r="1.5" fill="#1e293b" />
            {/* Cute mouth line */}
            <path d="M 33,24 Q 35,26 38,24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );

      default:
        return (
          <div style={{ width: size, height: size }} className="bg-slate-200 rounded-full flex items-center justify-center text-slate-400">
            ?
          </div>
        );
    }
  };

  return (
    <div className="relative inline-block transition-transform duration-300 hover:scale-110 hover:rotate-3 cursor-pointer">
      {renderIconContent()}
    </div>
  );
};
