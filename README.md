# OpenCascade.js 3D CAD Model Viewer

A comprehensive web-based 3D CAD model viewer and analysis system built with OpenCascade.js, Three.js, and integrated FreeCAD casting analysis capabilities.

## Features

### Core Functionality
- **3D Model Import**: Support for STEP and IGES file formats
- **Interactive Visualization**: Real-time 3D model viewing with orbit controls
- **Face Selection**: Click-to-select individual faces with visual highlighting
- **Physical Groups**: Create named groups of faces (inlet, outlet, wall, etc.)
- **STL Export**: Export selected face groups as individual STL files
- **Server Storage**: Automatic server-side storage of exported STL files

### Advanced Features
- **FreeCAD Integration**: Optional casting analysis service integration
- **Face Mapping**: Precise face indexing and geometry tracking
- **Drag & Drop**: Direct file upload via drag and drop interface
- **Responsive Design**: Clean, modern UI with gradient backgrounds
- **Debug Tools**: Comprehensive troubleshooting and logging capabilities

## Project Structure

```
src/
├── index.html                          # Main upload page
├── index.js                           # Upload page logic
├── common/
│   ├── freecadIntegration.js          # FreeCAD service integration
│   ├── openCascadeHelper.js           # OpenCascade utilities
│   └── visualize.js                   # 3D visualization core
└── demos/
    └── engine+export/
        ├── index.html                  # Viewer interface
        ├── index.js                   # Main viewer application
        ├── library.js                 # Three.js setup and utilities
        ├── fixes.js                   # Selection state management
        ├── serverStorage.js           # STL generation and storage
        ├── stlExporter.js             # Debug STL export utilities
        ├── server.js                  # Node.js backend server
        └── stl_storage/               # Server-side STL file storage
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- Modern web browser with WebGL support
- Optional: FreeCAD with Python API for advanced analysis

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd opencascade-viewer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install OpenCascade.js**
   ```bash
   npm install opencascade.js
   ```

4. **Install Three.js and dependencies**
   ```bash
   npm install three
   ```

5. **Start the development server**
   ```bash
   # For the STL storage backend
   cd src/demos/engine+export
   node server.js
   
   # In another terminal, serve the frontend
   # Use any static file server, e.g.:
   npx http-server src/ -p 8080
   ```

6. **Access the application**
   - Upload page: `http://localhost:8080`
   - Direct viewer: `http://localhost:8080/demos/engine+export/`

## Usage

### Basic Workflow

1. **Upload Model**
   - Navigate to the main page
   - Drag and drop a STEP/IGES file or click "Browse Files"
   - Click "Load Model in Viewer"

2. **Model Viewing**
   - Use mouse to orbit, zoom, and pan around the 3D model
   - Click on faces to highlight them
   - Model automatically loads with face indexing

3. **Create Physical Groups**
   - Press `I` for inlet selection mode
   - Press `O` for outlet selection mode  
   - Press `W` for wall selection mode
   - Click faces to add/remove from current selection
   - Press `Enter` to confirm selection and create group

4. **Export STL Files**
   - Selected groups are automatically exported as STL files
   - Files are stored on the server in `stl_storage/project-{id}/`
   - Each group gets its own STL file and metadata

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `I` | Start inlet selection mode |
| `O` | Start outlet selection mode |
| `W` | Start wall selection mode |
| `Enter` | Confirm current selection |

### Mouse Controls

| Action | Control |
|--------|---------|
| Orbit | Left click + drag |
| Pan | Right click + drag |
| Zoom | Mouse wheel |
| Select Face | Left click on face |

## API Reference

### Core Classes

#### `FreeCADCastingService`
Integration service for FreeCAD casting analysis.

```javascript
const service = new FreeCADCastingService('http://localhost:5001');
await service.checkHealth();
const analysis = await service.analyzeCasting(file);
```

#### `CastingAnalysisUI`
UI components for displaying analysis results.

```javascript
const ui = new CastingAnalysisUI();
ui.updateFaceInfo(faceInfo);
ui.updateAnalysisSummary(analysisResults);
```

### Core Functions

#### `importSTEP(openCascade, fileContents)`
Imports STEP files and creates face mapping.

```javascript
const imported = importSTEP(openCascade, fileContents);
// Returns: { shape, faceMap }
```

#### `visualize(openCascade, importedData)`
Converts OpenCascade geometry to Three.js meshes.

```javascript
const result = visualize(openCascade, importedData);
// Returns: { geometries, faceMap }
```

#### `setupServerStorage(selectionState, scene, options)`
Initializes automatic STL export and server storage.

```javascript
const projectId = setupServerStorage(selectionState, scene, {
  serverEndpoint: '/api/store-stl',
  openCascade: openCascadeInstance
});
```

## Configuration

### Server Configuration

The backend server runs on port 3000 by default. Configure in `server.js`:

```javascript
const PORT = process.env.PORT || 3000;
```

### FreeCAD Integration

Optional FreeCAD service configuration in `freecadIntegration.js`:

```javascript
const service = new FreeCADCastingService('http://localhost:5001');
```

### File Storage

STL files are stored in the `stl_storage` directory structure:
```
stl_storage/
└── project-{id}/
    ├── inlet.stl
    ├── inlet_metadata.json
    ├── outlet.stl
    └── outlet_metadata.json
```

## Development

### Adding New File Formats

1. Extend the file validation in `index.js`:
   ```javascript
   const validExtensions = ['.step', '.stp', '.iges', '.igs', '.your-format'];
   ```

2. Add import logic in `visualize.js`:
   ```javascript
   // Add new reader for your format
   const reader = new openCascade.YourFormatReader();
   ```

### Custom Selection Modes

Add new selection modes in `index.js`:

```javascript
// Add keyboard shortcut
if (event.key === 'r' || event.key === 'R') {
  startSelection('riser');
}
```

### Extending Analysis Features

The system is designed to integrate with external analysis services:

1. Implement your service in `freecadIntegration.js`
2. Add UI components in the analysis UI class
3. Update the face selection handler to use your analysis

## Troubleshooting

### Common Issues

1. **OpenCascade.js Loading Errors**
   - Ensure OpenCascade.js is properly installed
   - Check browser console for WASM loading errors
   - Verify file paths are correct

2. **Face Selection Not Working**
   - Use the troubleshooting button in the UI
   - Check console for face mapping errors
   - Verify mesh userData contains faceIndex

3. **STL Export Failures**
   - Check server is running on correct port
   - Verify CORS headers are properly set
   - Check OpenCascade instance is available

4. **File Upload Issues**
   - Verify file extensions are supported
   - Check file size limits
   - Ensure file is valid STEP/IGES format

### Debug Mode

Enable detailed logging by setting debug flags:

```javascript
// In browser console
localStorage.setItem('debug', 'true');
```

### Server Logs

Monitor server activity:

```bash
cd src/demos/engine+export
node server.js
# Check console output for requests and errors
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- Use ES6+ features
- Follow existing naming conventions
- Add JSDoc comments for public functions
- Include error handling and logging

## License

This project uses OpenCascade.js which is licensed under the LGPL. Please ensure compliance with licensing requirements for your use case.

## Dependencies

### Frontend
- **OpenCascade.js**: CAD kernel and geometry processing
- **Three.js**: 3D rendering and visualization
- **Modern Browser**: WebGL and ES6+ support

### Backend
- **Node.js**: Server runtime
- **Express**: Web framework
- **CORS**: Cross-origin resource sharing

### Optional
- **FreeCAD**: Advanced CAD analysis capabilities
- **Python**: For FreeCAD integration scripts

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Enable debug logging for detailed information
4. Check server logs for backend issues

## Roadmap

- [ ] Additional file format support (BREP, STL import)
- [ ] Advanced material assignment
- [ ] Mesh quality analysis
- [ ] Cloud storage integration
- [ ] Real-time collaboration features
- [ ] Mobile device optimization