import React, { useState } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:3001/api';

function App() {
  const [prompt, setPrompt] = useState('');
  const [author, setAuthor] = useState('');
  const [contentType, setContentType] = useState('text');
  const [generatedContent, setGeneratedContent] = useState('');
  const [contentHash, setContentHash] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const [generationInfo, setGenerationInfo] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [deleteKeyword, setDeleteKeyword] = useState('');

  const generateContent = async () => {
    if (!prompt || !author) {
      alert('Please enter both author name and prompt');
      return;
    }

    setLoading(true);
    setGenerationInfo(null);
    try {
      const response = await fetch(`${API_BASE_URL}/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, author, contentType }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedContent(data.content);
        setContentHash(data.contentHash);
        setVerificationUrl(data.verificationUrl);
        setGenerationInfo({
          model: data.model || 'AI Model',
          source: data.source || 'AI Service',
          theme: data.theme || null,
          note: data.note || null
        });
        alert('Content generated and registered on blockchain successfully!');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error generating content: ' + error.message);
    }
    setLoading(false);
  };

  const verifyContent = async () => {
    if (!generatedContent) {
      alert('Please generate content first or paste content to verify');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/verify-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: generatedContent }),
      });

      const data = await response.json();
      setVerificationResult(data);
    } catch (error) {
      alert('Error verifying content: ' + error.message);
    }
    setLoading(false);
  };

  const verifyByHash = async (hash) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/verify/${hash}`);
      const data = await response.json();
      setVerificationResult(data);
      setActiveTab('verify');
    } catch (error) {
      alert('Error verifying content: ' + error.message);
    }
    setLoading(false);
  };

  const clearAll = () => {
    setGeneratedContent('');
    setContentHash('');
    setVerificationUrl('');
    setVerificationResult(null);
    setGenerationInfo(null);
    setPrompt('');
  };

  // Admin Panel Functions
  const fetchStoredData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/records`);
      const data = await response.json();
      setAdminData(data);
    } catch (error) {
      alert('Error fetching data: ' + error.message);
    }
  };

  const deleteContent = async (contentHash) => {
    if (window.confirm('Are you sure you want to delete this content?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/delete/${contentHash}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
          alert('Content deleted successfully!');
          fetchStoredData();
        }
      } catch (error) {
        alert('Error deleting content: ' + error.message);
      }
    }
  };

  const deleteAllContent = async () => {
    if (window.confirm('⚠️ ARE YOU SURE? This will delete ALL generated content!')) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/delete-all`, {
          method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
          alert(data.message);
          fetchStoredData();
        }
      } catch (error) {
        alert('Error deleting all content: ' + error.message);
      }
    }
  };

  const deleteByKeyword = async () => {
    if (!deleteKeyword.trim()) {
      alert('Please enter a keyword to search for');
      return;
    }
    
    if (window.confirm(`Delete all content containing "${deleteKeyword}"?`)) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/delete-by-prompt/${encodeURIComponent(deleteKeyword)}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
          alert(data.message);
          setDeleteKeyword('');
          fetchStoredData();
        }
      } catch (error) {
        alert('Error deleting content: ' + error.message);
      }
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🧠 AI Content Authentication</h1>
        <p>Generate AI content with blockchain-proof authorship</p>
      </header>

      <div className="app-container">
        <nav className="tab-nav">
          <button 
            className={activeTab === 'generate' ? 'active' : ''}
            onClick={() => setActiveTab('generate')}
          >
            Generate Content
          </button>
          <button 
            className={activeTab === 'verify' ? 'active' : ''}
            onClick={() => setActiveTab('verify')}
          >
            Verify Content
          </button>
          <button 
            className={activeTab === 'demo' ? 'active' : ''}
            onClick={() => setActiveTab('demo')}
          >
            Live Demo
          </button>
          <button 
            className={activeTab === 'admin' ? 'active' : ''}
            onClick={() => {
              setActiveTab('admin');
              fetchStoredData();
            }}
          >
            🔧 Admin Panel
          </button>
        </nav>

        {activeTab === 'generate' && (
          <div className="tab-content">
            <h2>Generate AI Content</h2>
            <div className="input-group">
              <label>Your Name (Author):</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Enter your name as author"
              />
            </div>

            <div className="input-group">
              <label>Content Type:</label>
              <select 
                value={contentType} 
                onChange={(e) => setContentType(e.target.value)}
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
              </select>
            </div>

            <div className="input-group">
              <label>Content Prompt:</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  contentType === 'image' 
                    ? "Describe the image you want to generate... (e.g., 'portrait of a young girl', 'sunset landscape')"
                    : "Describe what you want to generate..."
                }
                rows="4"
              />
            </div>

            <div className="action-buttons">
              <button 
                onClick={generateContent} 
                disabled={loading}
                className="generate-btn"
              >
                {loading ? '🔄 Generating...' : '🚀 Generate & Register on Blockchain'}
              </button>
              {generatedContent && (
                <button 
                  onClick={clearAll}
                  className="clear-btn"
                >
                  🗑️ Clear All
                </button>
              )}
            </div>

            {generatedContent && (
              <div className="result-section">
                <h3>✅ Generated Content:</h3>
                <div className="content-box">
                  {contentType === 'image' ? (
                    <div className="image-container">
                      <img 
                        src={generatedContent} 
                        alt="Generated AI content" 
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/512x512/4A90E2/FFFFFF?text=Image+Not+Found';
                          e.target.alt = 'Fallback placeholder image';
                        }}
                      />
                      {generationInfo?.note && (
                        <div className="image-note">
                          💡 {generationInfo.note}
                        </div>
                      )}
                    </div>
                  ) : (
                    <pre>{generatedContent}</pre>
                  )}
                </div>
                
                <div className="hash-info">
                  <strong>Content Hash (SHA-256):</strong> 
                  <code>{contentHash}</code>
                </div>

                {generationInfo && (
                  <div className="generation-info">
                    <h4>Generation Details:</h4>
                    <p><strong>Model:</strong> {generationInfo.model}</p>
                    <p><strong>Source:</strong> {generationInfo.source}</p>
                    {generationInfo.theme && (
                      <p><strong>Theme:</strong> <span className="theme-badge">{generationInfo.theme}</span></p>
                    )}
                    {generationInfo.note && (
                      <p className="info-note">💡 {generationInfo.note}</p>
                    )}
                  </div>
                )}

                {verificationUrl && (
                  <div className="action-buttons">
                    <button 
                      onClick={() => verifyByHash(contentHash)}
                      className="verify-btn"
                    >
                      🔍 Verify This Content
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(verificationUrl);
                        alert('Verification URL copied to clipboard!');
                      }}
                      className="copy-btn"
                    >
                      📋 Copy Verification URL
                    </button>
                    {contentType === 'image' && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(generatedContent);
                          alert('Image URL copied to clipboard!');
                        }}
                        className="copy-btn"
                      >
                        📋 Copy Image URL
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'verify' && (
          <div className="tab-content">
            <h2>Verify Content Authenticity</h2>
            
            <div className="input-group">
              <label>Content to Verify:</label>
              <textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                placeholder="Paste content here to verify its authenticity..."
                rows="6"
              />
            </div>

            <div className="action-buttons">
              <button 
                onClick={verifyContent} 
                disabled={loading}
                className="verify-btn"
              >
                {loading ? '🔍 Verifying...' : '🔍 Verify Content Authenticity'}
              </button>
              <button 
                onClick={clearAll}
                className="clear-btn"
              >
                🗑️ Clear
              </button>
            </div>

            {verificationResult && (
              <div className={`verification-result ${verificationResult.verified ? 'verified' : 'not-verified'}`}>
                <h3>Verification Result:</h3>
                <div className="result-badge">
                  {verificationResult.verified ? '✅ VERIFIED' : '❌ NOT VERIFIED'}
                </div>
                
                <div className="verification-details">
                  <p><strong>Content Hash:</strong> <code>{verificationResult.contentHash}</code></p>
                  
                  {verificationResult.blockchainData && (
                    <>
                      <p><strong>Author:</strong> {verificationResult.blockchainData.author}</p>
                      <p><strong>Timestamp:</strong> {new Date(verificationResult.blockchainData.timestamp).toLocaleString()}</p>
                      <p><strong>Network:</strong> Sepolia Testnet</p>
                      <p><strong>Transaction Hash:</strong> <code>{verificationResult.blockchainData.hash}</code></p>
                    </>
                  )}

                  {verificationResult.contentRecord && (
                    <div className="original-record">
                      <h4>Original Content Details:</h4>
                      <p><strong>Prompt:</strong> {verificationResult.contentRecord.prompt}</p>
                      <p><strong>Content Type:</strong> {verificationResult.contentRecord.contentType}</p>
                      <p><strong>Generated:</strong> {new Date(verificationResult.contentRecord.timestamp).toLocaleString()}</p>
                    </div>
                  )}

                  {!verificationResult.verified && (
                    <div className="verification-help">
                      <p>⚠️ This content may not be registered on the blockchain or could be tampered with.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'demo' && (
          <div className="tab-content">
            <h2>Live Demo</h2>
            <p>Try this demo workflow to showcase blockchain-based content authentication:</p>
            
            <div className="demo-steps">
              <div className="step">
                <h3>🎯 Step 1: Generate Text Content</h3>
                <p><strong>Author:</strong> Your Name</p>
                <p><strong>Content Type:</strong> Text</p>
                <p><strong>Prompt:</strong> <code>"How blockchain verifies AI content authenticity"</code></p>
                <button 
                  onClick={() => {
                    setAuthor('Demo User');
                    setContentType('text');
                    setPrompt('How blockchain verifies AI content authenticity');
                    setActiveTab('generate');
                  }}
                  className="demo-btn"
                >
                  🚀 Try This Demo
                </button>
              </div>
              
              <div className="step">
                <h3>🖼️ Step 2: Generate Image Content</h3>
                <p><strong>Author:</strong> Your Name</p>
                <p><strong>Content Type:</strong> Image</p>
                <p><strong>Prompt:</strong> <code>"portrait of a young girl"</code></p>
                <button 
                  onClick={() => {
                    setAuthor('Demo User');
                    setContentType('image');
                    setPrompt('portrait of a young girl');
                    setActiveTab('generate');
                  }}
                  className="demo-btn"
                >
                  🎨 Try This Demo
                </button>
              </div>
              
              <div className="step">
                <h3>🔍 Step 3: Verify Content</h3>
                <p>After generation, use the "Verify This Content" button to check blockchain authentication</p>
                <p>View the content hash, timestamp, and transaction details</p>
              </div>
            </div>

            <div className="demo-features">
              <h3>✨ Features Demonstrated:</h3>
              <ul>
                <li>🤖 <strong>AI Text Generation</strong> - Free AI APIs for content creation</li>
                <li>🖼️ <strong>AI Image Generation</strong> - Themed placeholder images</li>
                <li>⛓️ <strong>Blockchain Proof</strong> - Simulated Ethereum transactions</li>
                <li>🔍 <strong>Content Verification</strong> - Tamper-proof authenticity checks</li>
                <li>📝 <strong>Immutable Timestamping</strong> - Proof of creation time</li>
                <li>🔗 <strong>Shareable URLs</strong> - Unique verification links</li>
                <li>🔐 <strong>Cryptographic Hashing</strong> - SHA-256 content fingerprints</li>
              </ul>
            </div>

            <div className="tech-stack">
              <h3>🛠️ Technology Stack:</h3>
              <div className="tech-badges">
                <span className="tech-badge">React.js</span>
                <span className="tech-badge">Node.js</span>
                <span className="tech-badge">Express.js</span>
                <span className="tech-badge">Ethereum</span>
                <span className="tech-badge">SHA-256</span>
                <span className="tech-badge">AI APIs</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="tab-content">
            <h2>🔧 Content Management Panel</h2>
            
            <div className="admin-actions">
              <div className="action-group">
                <h3>📊 Storage Overview</h3>
                {adminData && (
                  <div className="storage-info">
                    <p><strong>Total Records:</strong> {adminData.count}</p>
                    <button 
                      onClick={fetchStoredData}
                      className="refresh-btn"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                )}
              </div>

              <div className="action-group">
                <h3>🗑️ Delete Content</h3>
                
                <div className="delete-actions">
                  <button 
                    onClick={deleteAllContent}
                    className="danger-btn"
                  >
                    🚨 Delete ALL Content
                  </button>
                  
                  <div className="keyword-delete">
                    <input
                      type="text"
                      value={deleteKeyword}
                      onChange={(e) => setDeleteKeyword(e.target.value)}
                      placeholder="Enter keyword to search and delete..."
                      className="keyword-input"
                    />
                    <button 
                      onClick={deleteByKeyword}
                      className="danger-btn"
                    >
                      🔍 Delete by Keyword
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {adminData && adminData.records && adminData.records.length > 0 ? (
              <div className="records-list">
                <h3>📝 Stored Content ({adminData.count} records)</h3>
                {adminData.records.map((record, index) => (
                  <div key={record.id} className="record-item">
                    <div className="record-header">
                      <span className="record-index">#{index + 1}</span>
                      <span className="record-type">{record.contentType}</span>
                      <span className="record-time">
                        {new Date(record.timestamp).toLocaleString()}
                      </span>
                      <button 
                        onClick={() => deleteContent(record.id)}
                        className="delete-btn"
                      >
                        ❌ Delete
                      </button>
                    </div>
                    <div className="record-details">
                      <p><strong>Author:</strong> {record.author}</p>
                      <p><strong>Prompt:</strong> {record.prompt}</p>
                      <p><strong>Content:</strong> {record.contentPreview}</p>
                      <p><strong>Hash:</strong> <code>{record.contentHash}</code></p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-records">
                <p>No content stored in memory.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="app-footer">
        <p>Built for Blockchain Hackathon | AI Content Authentication System</p>
        <p>🔗 Blockchain Verified | 🤖 AI Powered | 🔐 Cryptographically Secure</p>
      </footer>
    </div>
  );
}

export default App;