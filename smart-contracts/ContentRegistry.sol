// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ContentRegistry {
    struct ContentRecord {
        bytes32 contentHash;
        address author;
        uint256 timestamp;
        string metadata;
    }
    
    mapping(bytes32 => ContentRecord) public contentRecords;
    mapping(address => bytes32[]) public authorContents;
    
    event ContentRegistered(
        bytes32 indexed contentHash,
        address indexed author,
        uint256 timestamp,
        string metadata
    );
    
    function registerContent(
        bytes32 _contentHash,
        string memory _metadata
    ) public {
        require(contentRecords[_contentHash].timestamp == 0, "Content already registered");
        
        ContentRecord memory newRecord = ContentRecord({
            contentHash: _contentHash,
            author: msg.sender,
            timestamp: block.timestamp,
            metadata: _metadata
        });
        
        contentRecords[_contentHash] = newRecord;
        authorContents[msg.sender].push(_contentHash);
        
        emit ContentRegistered(_contentHash, msg.sender, block.timestamp, _metadata);
    }
    
    function verifyContent(bytes32 _contentHash) public view returns (
        address author,
        uint256 timestamp,
        string memory metadata
    ) {
        ContentRecord memory record = contentRecords[_contentHash];
        require(record.timestamp != 0, "Content not registered");
        
        return (record.author, record.timestamp, record.metadata);
    }
    
    function getAuthorContents(address _author) public view returns (bytes32[] memory) {
        return authorContents[_author];
    }
    
    function isContentRegistered(bytes32 _contentHash) public view returns (bool) {
        return contentRecords[_contentHash].timestamp != 0;
    }
}