const express = require('express');
const cors = require('cors');
require('dotenv').config();

const AIService = require('./ai-service');
const BlockchainService = require('./blockchain');
const path = require('path');

const app = express();

// Enhanced CORS for Railway + Vercel
app.use(cors({
  origin: function (origin, callback) {
    // Allow all origins in production for demo (Railway + Vercel)
    if (!origin || process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:3000',
      'https://ai-content-auth.vercel.app',
      /\.vercel\.app$/,
      /\.up\.railway\.app$/,
      /\.onrender\.app$/
    ];
    
    if (allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return origin === pattern;
      }
      return pattern.test(origin);
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const aiService = new AIService();
const blockchainService = new BlockchainService();

// In-memory storage for demo
const contentDatabase = new Map();

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: '🤖 AI Content Authentication API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            generate: '/api/generate-content',
            verify: '/api/verify/:contentHash',
            verifyContent: '/api/verify-content',
            records: '/api/records',
            delete: '/api/delete/:contentHash',
            deleteAll: '/api/delete-all',
            deleteByPrompt: '/api/delete-by-prompt/:keyword'
        },
        status: 'running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        deployment: 'railway-vercel'
    });
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is working!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'AI Content Authentication API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage(),
        database: {
            records: contentDatabase.size,
            type: 'in-memory'
        }
    });
});

// Generate AI content and register on blockchain
app.post('/api/generate-content', async (req, res) => {
    try {
        const { prompt, author, contentType = 'text' } = req.body;

        if (!prompt || !author) {
            return res.status(400).json({
                success: false,
                error: 'Prompt and author are required'
            });
        }

        console.log(`🚀 Generating ${contentType} content for: ${prompt}`);

        // Generate AI content
        let aiResult;
        if (contentType === 'image') {
            aiResult = await aiService.generateImage(prompt);
        } else {
            aiResult = await aiService.generateText(prompt);
        }

        if (!aiResult.success) {
            return res.status(500).json({
                success: false,
                error: aiResult.error
            });
        }

        // Generate content hash
        const contentHash = blockchainService.generateContentHash(
            contentType === 'image' ? prompt : aiResult.content
        );

        // Store hash on blockchain
        const blockchainResult = await blockchainService.storeHash(
            contentHash,
            author,
            JSON.stringify({
                prompt: prompt,
                contentType: contentType,
                model: aiResult.model,
                timestamp: new Date().toISOString()
            })
        );

        if (!blockchainResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Blockchain storage failed: ' + blockchainResult.error
            });
        }

        // Store in database
        const baseUrl = process.env.NODE_ENV === 'production' 
            ? `https://${req.get('host')}`
            : `${req.protocol}://${req.get('host')}`;

        const contentRecord = {
            id: contentHash,
            content: aiResult.content,
            contentType: contentType,
            prompt: prompt,
            author: author,
            hash: contentHash,
            blockchainTransaction: blockchainResult.transaction,
            timestamp: new Date().toISOString(),
            verificationUrl: `${baseUrl}/api/verify/${contentHash}`
        };

        contentDatabase.set(contentHash, contentRecord);

        console.log(`✅ Content generated and stored. Hash: ${contentHash}`);

        res.json({
            success: true,
            content: aiResult.content,
            contentType: contentType,
            contentHash: contentHash,
            transaction: blockchainResult.transaction,
            verificationUrl: contentRecord.verificationUrl,
            recordId: contentHash,
            model: aiResult.model,
            source: aiResult.source,
            timestamp: contentRecord.timestamp
        });

    } catch (error) {
        console.error('💥 Server Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Verify content by hash
app.get('/api/verify/:contentHash', async (req, res) => {
    try {
        const { contentHash } = req.params;

        console.log(`🔍 Verifying content with hash: ${contentHash}`);

        const contentRecord = contentDatabase.get(contentHash);
        
        if (!contentRecord) {
            console.log(`❌ Content not found: ${contentHash}`);
            return res.status(404).json({
                verified: false,
                error: 'Content not found in database',
                contentHash: contentHash
            });
        }

        const blockchainResult = await blockchainService.verifyHash(contentHash);

        console.log(`✅ Verification result: ${blockchainResult.verified}`);

        res.json({
            verified: blockchainResult.verified,
            contentHash: contentHash,
            author: contentRecord.author,
            timestamp: contentRecord.timestamp,
            contentType: contentRecord.contentType,
            prompt: contentRecord.prompt,
            blockchainData: blockchainResult.data,
            content: contentRecord.content,
            verificationUrl: contentRecord.verificationUrl,
            model: contentRecord.model,
            source: contentRecord.source
        });

    } catch (error) {
        console.error('💥 Verification Error:', error);
        res.status(500).json({
            verified: false,
            error: error.message,
            contentHash: req.params.contentHash
        });
    }
});

// Verify content by providing the actual content
app.post('/api/verify-content', async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                verified: false,
                error: 'Content is required'
            });
        }

        console.log(`🔍 Verifying content by content body`);

        const contentHash = blockchainService.generateContentHash(content);
        const blockchainResult = await blockchainService.verifyHash(contentHash);
        const contentRecord = contentDatabase.get(contentHash);

        res.json({
            contentHash: contentHash,
            verified: blockchainResult.verified,
            blockchainData: blockchainResult.data,
            contentRecord: contentRecord || null,
            existsInDatabase: !!contentRecord
        });

    } catch (error) {
        console.error('💥 Content Verification Error:', error);
        res.status(500).json({
            verified: false,
            error: error.message
        });
    }
});

// Get all content records
app.get('/api/records', (req, res) => {
    try {
        const records = Array.from(contentDatabase.values());
        
        const safeRecords = records.map(record => ({
            id: record.id,
            prompt: record.prompt,
            contentType: record.contentType,
            author: record.author,
            timestamp: record.timestamp,
            contentHash: record.hash,
            contentPreview: record.contentType === 'text' 
                ? record.content.substring(0, 100) + '...' 
                : '[Image URL]',
            model: record.model,
            source: record.source
        }));
        
        console.log(`📊 Admin request: ${records.length} records retrieved`);

        res.json({
            success: true,
            count: records.length,
            records: safeRecords,
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        console.error('💥 Records Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete specific content by hash
app.delete('/api/delete/:contentHash', (req, res) => {
    try {
        const { contentHash } = req.params;
        
        console.log(`🗑️ Delete request for hash: ${contentHash}`);
        
        if (contentDatabase.has(contentHash)) {
            contentDatabase.delete(contentHash);
            console.log(`✅ Content deleted: ${contentHash}`);
            res.json({
                success: true,
                message: 'Content deleted successfully',
                contentHash: contentHash
            });
        } else {
            console.log(`❌ Content not found for deletion: ${contentHash}`);
            res.status(404).json({
                success: false,
                error: 'Content not found',
                contentHash: contentHash
            });
        }
    } catch (error) {
        console.error('💥 Delete Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete all content
app.delete('/api/delete-all', (req, res) => {
    try {
        const recordCount = contentDatabase.size;
        contentDatabase.clear();
        
        console.log(`🗑️ All content deleted. Records removed: ${recordCount}`);
        
        res.json({
            success: true,
            message: `All ${recordCount} records deleted successfully`,
            deletedCount: recordCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('💥 Delete All Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete by keyword
app.delete('/api/delete-by-prompt/:keyword', (req, res) => {
    try {
        const { keyword } = req.params;
        const lowerKeyword = keyword.toLowerCase();
        
        console.log(`🔍 Delete by keyword: "${keyword}"`);
        
        let deletedCount = 0;
        const deletedHashes = [];
        
        for (const [hash, record] of contentDatabase.entries()) {
            if (record.prompt.toLowerCase().includes(lowerKeyword)) {
                contentDatabase.delete(hash);
                deletedCount++;
                deletedHashes.push(hash);
            }
        }
        
        console.log(`✅ Deleted ${deletedCount} records containing "${keyword}"`);
        
        res.json({
            success: true,
            message: `Deleted ${deletedCount} records containing "${keyword}"`,
            deletedCount: deletedCount,
            keyword: keyword,
            deletedHashes: deletedHashes
        });
    } catch (error) {
        console.error('💥 Delete by Keyword Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve frontend build in production (for Railway static serving)
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/build')));
    
    // Catch all handler for SPA
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
    });
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Global Error Handler:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎉 ==========================================`);
    console.log(`🚀 AI Content Authentication API Server`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🕒 Started: ${new Date().toISOString()}`);
    console.log(`💾 Memory: ${process.memoryUsage().rss / 1024 / 1024} MB`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
    console.log(`📚 API Docs: http://localhost:${PORT}/`);
    console.log(`🎯 ==========================================\n`);
    
    // Log deployment info
    if (process.env.NODE_ENV === 'production') {
        console.log(`🏗️  Production Mode: Frontend serving enabled`);
        console.log(`📦 Deployment: Railway + Vercel`);
    } else {
        console.log(`🔧 Development Mode: CORS enabled for localhost:3000`);
    }
});