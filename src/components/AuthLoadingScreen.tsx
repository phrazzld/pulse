'use client';

interface AuthLoadingScreenProps {
  message?: string;
  subMessage?: string;
}

/**
 * A stylized loading screen for authentication transitions
 */
export default function AuthLoadingScreen({
  message = 'Verifying Authentication',
  subMessage = 'Please wait while we verify your credentials'
}: AuthLoadingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--gradient-bg)' }}>
      <div className="card w-full max-w-md p-8 space-y-8 border-2" style={{ 
        backgroundColor: 'rgba(27, 43, 52, 0.7)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 0 20px rgba(0, 255, 135, 0.2)',
        borderColor: 'var(--neon-green)'
      }}>
        {/* Terminal-style header */}
        <div className="flex items-center mb-4">
          <div className="flex space-x-1 mr-3">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i} 
                className="w-2 h-2 rounded-full" 
                style={{ 
                  backgroundColor: i === 0 
                    ? 'var(--neon-green)' 
                    : i === 1 
                      ? 'var(--electric-blue)' 
                      : 'var(--foreground)'
                }}
              />
            ))}
          </div>
          <div className="h-px flex-grow" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
        </div>
        
        <h2 className="text-xl text-center" style={{ color: 'var(--neon-green)' }}>{message}</h2>
        
        <div className="flex justify-center items-start space-x-4 p-4 border border-opacity-30 rounded-md" style={{ 
          borderColor: 'var(--electric-blue)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ color: 'var(--electric-blue)' }}>
            <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div className="space-y-2 flex-1">
            <p className="text-sm animate-pulse" style={{ color: 'var(--electric-blue)' }}>
              &gt; System access verification in progress...
            </p>
            <p className="text-xs" style={{ color: 'var(--foreground)' }}>
              &gt; {subMessage}
            </p>
            <div className="flex space-x-1 text-xs mt-2" style={{ color: 'var(--foreground)' }}>
              <span>&gt;</span>
              <span className="animate-pulse">|</span>
            </div>
          </div>
        </div>
        
        <div className="text-center text-xs" style={{ color: 'var(--foreground)' }}>
          <p>SECURE CONNECTION ESTABLISHED</p>
          <div className="flex justify-center items-center mt-2">
            <div className="h-px w-8" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
            <div className="px-2">•</div>
            <div className="h-px w-8" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}