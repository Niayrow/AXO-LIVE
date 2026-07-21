export default function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 800 320"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Sky gradient */}
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5B9BD5" />
          <stop offset="100%" stopColor="#7EC8E3" />
        </linearGradient>
        <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8BC4A0" />
          <stop offset="100%" stopColor="#6BAF82" />
        </linearGradient>
      </defs>

      <rect width="800" height="320" fill="url(#skyGrad)" />

      {/* Clouds */}
      <ellipse cx="120" cy="60" rx="60" ry="25" fill="white" opacity="0.7" />
      <ellipse cx="160" cy="55" rx="40" ry="20" fill="white" opacity="0.7" />
      <ellipse cx="600" cy="45" rx="70" ry="28" fill="white" opacity="0.6" />
      <ellipse cx="650" cy="40" rx="45" ry="22" fill="white" opacity="0.6" />

      {/* Ground */}
      <rect x="0" y="240" width="800" height="80" fill="url(#groundGrad)" />
      <rect x="0" y="240" width="800" height="4" fill="#5A9E72" />

      {/* Road */}
      <rect x="0" y="265" width="800" height="30" fill="#555" />
      <rect x="0" y="278" width="800" height="3" fill="#FFD700" opacity="0.6" />

      {/* Bus stop shelter */}
      <rect x="580" y="200" width="80" height="65" rx="4" fill="#E8574A" opacity="0.9" />
      <rect x="585" y="205" width="70" height="50" rx="2" fill="#FFF" opacity="0.3" />
      <rect x="610" y="265" width="20" height="5" fill="#888" />

      {/* Bus */}
      <rect x="280" y="230" width="140" height="45" rx="8" fill="#E8574A" />
      <rect x="290" y="238" width="50" height="28" rx="4" fill="#87CEEB" opacity="0.8" />
      <rect x="350" y="238" width="55" height="28" rx="4" fill="#87CEEB" opacity="0.8" />
      <circle cx="305" cy="278" r="10" fill="#333" />
      <circle cx="395" cy="278" r="10" fill="#333" />
      <rect x="295" y="222" width="30" height="10" rx="3" fill="#3A7D5C" />
      <text x="310" y="260" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">AXO</text>

      {/* People */}
      <circle cx="520" cy="248" r="8" fill="#FFDAB9" />
      <rect x="514" y="256" width="12" height="18" rx="4" fill="#3A7D5C" />
      <circle cx="545" cy="250" r="7" fill="#FFDAB9" />
      <rect x="540" y="257" width="10" height="16" rx="3" fill="#E8574A" />

      {/* Trees */}
      <rect x="80" y="220" width="8" height="25" fill="#8B6914" />
      <circle cx="84" cy="210" r="22" fill="#3A7D5C" />
      <rect x="700" y="215" width="8" height="30" fill="#8B6914" />
      <circle cx="704" cy="200" r="25" fill="#2D6A4F" />

      {/* Building */}
      <rect x="30" y="170" width="60" height="70" fill="#DDD" />
      <rect x="38" y="180" width="12" height="12" fill="#87CEEB" opacity="0.7" />
      <rect x="55" y="180" width="12" height="12" fill="#87CEEB" opacity="0.7" />
      <rect x="38" y="200" width="12" height="12" fill="#87CEEB" opacity="0.7" />
      <rect x="55" y="200" width="12" height="12" fill="#87CEEB" opacity="0.7" />
    </svg>
  );
}
