// Server-side implementation (Node.js with Express)
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();

// Support parsing large JSON payloads (STL files can be large)
app.use(bodyParser.json({ limit: '50mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Also add a simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'STL storage server is running' });
});


// Route to handle STL storage
app.post('/api/store-stl', async (req, res) => {
  try {
    const { projectId, groupName, stlData, metadata } = req.body;
    
    if (!projectId || !groupName || !stlData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    // Create project directory if it doesn't exist
    const projectDir = path.join(__dirname, 'stl_storage', projectId);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // Convert base64 back to binary
    const binaryData = Buffer.from(stlData, 'base64');
    
    // Save the STL file
    const filename = `${groupName}.stl`;
    const filePath = path.join(projectDir, filename);
    
    fs.writeFileSync(filePath, binaryData);
    
    // Save metadata as JSON
    if (metadata) {
      const metadataPath = path.join(projectDir, `${groupName}_metadata.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }
    
    console.log(`Saved STL file: ${filePath}`);
    
    // Return success with file info
    res.json({
      success: true,
      filePath: filePath,
      fileSize: binaryData.length,
      projectId: projectId,
      groupName: groupName
    });
    
  } catch (error) {
    console.error('Error handling STL storage:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route to get project status
app.get('/api/project/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const projectDir = path.join(__dirname, 'stl_storage', projectId);
    
    if (!fs.existsSync(projectDir)) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Get list of STL files in the project
    const files = fs.readdirSync(projectDir)
      .filter(file => file.endsWith('.stl'))
      .map(file => {
        const filePath = path.join(projectDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime
        };
      });
    
    res.json({
      success: true,
      projectId: projectId,
      files: files
    });
    
  } catch (error) {
    console.error('Error getting project status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`STL files will be stored in: ${path.join(__dirname, 'stl_storage')}`);
});