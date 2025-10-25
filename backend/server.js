const express = require('express');
const cors = require('cors');
require('dotenv').config();

const AIService = require('./ai-service');
const BlockchainService = require('./blockchain');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const aiService = new AIService();
const blockchainService = new BlockchainService();


const contentDatabase = new Map();

// const PORT = process.env.PORT || 3001; // Render uses different ports

// Also update CORS for production:
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://ai-content-auth-frontend.onrender.com' // Will be auto-generated
  ],
  credentials: true
}));


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
        timestamp: new Date().toISOString()
    });
});


app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is working!',
        timestamp: new Date().toISOString()
    });
});


app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'AI Content Authentication API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});


app.post('/api/generate-content', async (req, res) => {
    try {
        const { prompt, author, contentType = 'text' } = req.body;

        if (!prompt || !author) {
            return res.status(400).json({
                success: false,
                error: 'Prompt and author are required'
            });
        }

        console.log(`Generating ${contentType} content for: ${prompt}`);

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
        const contentRecord = {
            id: contentHash,
            content: aiResult.content,
            contentType: contentType,
            prompt: prompt,
            author: author,
            hash: contentHash,
            blockchainTransaction: blockchainResult.transaction,
            timestamp: new Date().toISOString(),
            verificationUrl: `${req.protocol}://${req.get('host')}/api/verify/${contentHash}`
        };

        contentDatabase.set(contentHash, contentRecord);

        res.json({
            success: true,
            content: aiResult.content,
            contentType: contentType,
            contentHash: contentHash,
            transaction: blockchainResult.transaction,
            verificationUrl: contentRecord.verificationUrl,
            recordId: contentHash,
            model: aiResult.model,
            source: aiResult.source
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

// Verify content by hash
app.get('/api/verify/:contentHash', async (req, res) => {
    try {
        const { contentHash } = req.params;

        
        const contentRecord = contentDatabase.get(contentHash);
        
        if (!contentRecord) {
            return res.status(404).json({
                verified: false,
                error: 'Content not found in database'
            });
        }

        
        const blockchainResult = await blockchainService.verifyHash(contentHash);

        res.json({
            verified: blockchainResult.verified,
            contentHash: contentHash,
            author: contentRecord.author,
            timestamp: contentRecord.timestamp,
            contentType: contentRecord.contentType,
            prompt: contentRecord.prompt,
            blockchainData: blockchainResult.data,
            content: contentRecord.content,
            verificationUrl: contentRecord.verificationUrl
        });

    } catch (error) {
        res.status(500).json({
            verified: false,
            error: error.message
        });
    }
});


app.post('/api/verify-content', async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                verified: false,
                error: 'Content is required'
            });
        }

        const contentHash = blockchainService.generateContentHash(content);
        const blockchainResult = await blockchainService.verifyHash(contentHash);
        const contentRecord = contentDatabase.get(contentHash);

        res.json({
            contentHash: contentHash,
            verified: blockchainResult.verified,
            blockchainData: blockchainResult.data,
            contentRecord: contentRecord || null
        });

    } catch (error) {
        res.status(500).json({
            verified: false,
            error: error.message
        });
    }
});


app.get('/api/records', (req, res) => {
    try {
        const records = Array.from(contentDatabase.values());
        
        // Hide actual content for privacy, just show metadata
        const safeRecords = records.map(record => ({
            id: record.id,
            prompt: record.prompt,
            contentType: record.contentType,
            author: record.author,
            timestamp: record.timestamp,
            contentHash: record.hash,
            contentPreview: record.contentType === 'text' 
                ? record.content.substring(0, 100) + '...' 
                : '[Image URL]'
        }));
        
        res.json({
            success: true,
            count: records.length,
            records: safeRecords
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


app.delete('/api/delete/:contentHash', (req, res) => {
    try {
        const { contentHash } = req.params;
        
        if (contentDatabase.has(contentHash)) {
            contentDatabase.delete(contentHash);
            res.json({
                success: true,
                message: 'Content deleted successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


app.delete('/api/delete-all', (req, res) => {
    try {
        const recordCount = contentDatabase.size;
        contentDatabase.clear();
        
        res.json({
            success: true,
            message: `All ${recordCount} records deleted successfully`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


app.delete('/api/delete-by-prompt/:keyword', (req, res) => {
    try {
        const { keyword } = req.params;
        const lowerKeyword = keyword.toLowerCase();
        
        let deletedCount = 0;
        
        for (const [hash, record] of contentDatabase.entries()) {
            if (record.prompt.toLowerCase().includes(lowerKeyword)) {
                contentDatabase.delete(hash);
                deletedCount++;
            }
        }
        
        res.json({
            success: true,
            message: `Deleted ${deletedCount} records containing "${keyword}"`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/build')));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
    });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` API Health: http://localhost:${PORT}/api/health`);
    console.log(` Root URL: http://localhost:${PORT}/`);
    console.log(` Test URL: http://localhost:${PORT}/test`);
    console.log(` Admin Panel: Available via frontend`);
});