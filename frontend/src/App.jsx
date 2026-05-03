import { useState } from 'react';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  const handleCommit = async () => {
    setIsLoading(true);
    setStatus(null);

    try {
      const response = await fetch('http://localhost:3000/api/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus({ type: 'success', message: data.message || 'Commit successful!' });
      } else {
        setStatus({ type: 'error', message: data.message || 'Failed to make commit.' });
      }
    } catch (error) {
      console.error('Error triggering commit:', error);
      setStatus({ type: 'error', message: 'Could not connect to the local API server.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="card">
        <div>
          <h1>Git Auto Committer</h1>
          <p>Instantly generate and push a commit for today.</p>
        </div>

        <button 
          className="commit-button" 
          onClick={handleCommit} 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="spinner"></div>
              Committing...
            </>
          ) : (
            'Trigger Commit'
          )}
        </button>

        {status && (
          <div className={`status-message status-${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
