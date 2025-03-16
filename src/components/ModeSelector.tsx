// Removed unused import

export type ActivityMode = 'my-activity' | 'my-work-activity' | 'team-activity';

export interface ModeSelectorProps {
  selectedMode: ActivityMode;
  onChange: (mode: ActivityMode) => void;
  disabled?: boolean;
}

export default function ModeSelector({ 
  selectedMode,
  onChange,
  disabled = false
}: ModeSelectorProps) {
  // Define the available modes with their display names
  const modes: { id: ActivityMode; label: string; description: string }[] = [
    { 
      id: 'my-activity', 
      label: 'MY ACTIVITY', 
      description: 'View your commits across all repositories'
    },
    { 
      id: 'my-work-activity', 
      label: 'MY WORK ACTIVITY', 
      description: 'View your commits within selected organizations'
    },
    { 
      id: 'team-activity', 
      label: 'TEAM ACTIVITY', 
      description: 'View all team members\' activity within selected organizations'
    },
  ];

  // Handle mode change
  const handleModeChange = (mode: ActivityMode) => {
    if (!disabled) {
      onChange(mode);
    }
  };

  return (
    <div className="rounded-lg border" style={{ 
      backgroundColor: 'rgba(27, 43, 52, 0.7)',
      backdropFilter: 'blur(5px)',
      borderColor: 'var(--neon-green)',
    }}>
      <div className="p-3 border-b" style={{ borderColor: 'var(--neon-green)' }}>
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--neon-green)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--neon-green)' }}>
            ACTIVITY MODE
          </h3>
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-3">
          {modes.map((mode) => (
            <div 
              key={mode.id}
              className={`p-3 rounded-md transition-all duration-200 cursor-pointer ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ 
                backgroundColor: selectedMode === mode.id 
                  ? 'rgba(0, 255, 135, 0.1)' 
                  : 'rgba(27, 43, 52, 0.5)',
                borderLeft: `3px solid ${selectedMode === mode.id ? 'var(--neon-green)' : 'transparent'}`,
              }}
              onClick={() => handleModeChange(mode.id)}
              role="radio"
              aria-checked={selectedMode === mode.id}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleModeChange(mode.id);
                }
              }}
            >
              <div className="flex items-center">
                <div 
                  className="w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center"
                  style={{ 
                    borderColor: 'var(--neon-green)',
                  }}
                >
                  {selectedMode === mode.id && (
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--neon-green)' }}
                    />
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                    {mode.label}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--electric-blue)' }}>
                    {mode.description}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}