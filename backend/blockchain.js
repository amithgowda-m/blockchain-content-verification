
const { ethers } = require('ethers');
const crypto = require('crypto');

class BlockchainService {
    constructor() {
       
        this.providers = {
            sepolia: 'https://rpc.sepolia.org',
            alchemy: 'https://eth-sepolia.g.alchemy.com/v2/demo'
        };
        
        this.contractAddress = '0x...'; 
        this.contractABI = [
            "function registerContent(bytes32 contentHash, string memory metadata) public",
            "function verifyContent(bytes32 contentHash) public view returns (address, uint256, string memory)",
            "event ContentRegistered(bytes32 indexed contentHash, address indexed author, uint256 timestamp, string metadata)"
        ];
        
        this.provider = new ethers.JsonRpcProvider(this.providers.sepolia);
    }

    generateContentHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    async storeHash(contentHash, author, metadata = '') {
        try {
            
            const mockTransaction = {
                hash: crypto.randomBytes(32).toString('hex'),
                contentHash: contentHash,
                author: author,
                timestamp: Date.now(),
                blockNumber: Math.floor(Math.random() * 1000000),
                status: 'success',
                network: 'sepolia'
            };

           
            
            return {
                success: true,
                transaction: mockTransaction
            };
        } catch (error) {
            console.error('Blockchain Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async verifyHash(contentHash) {
        try {
            
            const mockVerification = {
                exists: Math.random() > 0.3, 
                contentHash: contentHash,
                timestamp: Date.now() - Math.floor(Math.random() * 100000000),
                author: '0x' + crypto.randomBytes(20).toString('hex')
            };

            return {
                success: true,
                verified: mockVerification.exists,
                data: mockVerification
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = BlockchainService;