// freecadIntegration.js
// Integration module for connecting OpenCascade.js frontend with FreeCAD casting analysis service

export class FreeCADCastingService {
    constructor(baseUrl = 'http://localhost:5001') {
        this.baseUrl = baseUrl;
        this.isAvailable = false;
        this.currentAnalysis = null;
        this.featureColors = {
            'inlet': 0xFF4444,
            'runner': 0x44FF44,
            'riser': 0x4444FF,
            'gate': 0xFFFF44,
            'main_casting': 0xFF44FF,
            'unknown': 0x888888
        };
    }

    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const data = await response.json();
            this.isAvailable = data.status === 'healthy';
            return this.isAvailable;
        } catch (error) {
            console.error('FreeCAD service health check failed:', error);
            this.isAvailable = false;
            return false;
        }
    }

    async analyzeCasting(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${this.baseUrl}/analyze_casting`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Analysis failed');
            }

            this.currentAnalysis = data.results;
            return data.results;
        } catch (error) {
            console.error('Casting analysis failed:', error);
            throw error;
        }
    }

    async getFaceGeometry(faceIndex) {
        try {
            const response = await fetch(`${this.baseUrl}/face_geometry/${faceIndex}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to get face geometry');
            }

            return data.geometry;
        } catch (error) {
            console.error('Face geometry request failed:', error);
            throw error;
        }
    }

    async getFeatureTypes() {
        try {
            const response = await fetch(`${this.baseUrl}/feature_types`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to get feature types');
            }

            return data.feature_types;
        } catch (error) {
            console.error('Feature types request failed:', error);
            return {};
        }
    }

    getFeatureColor(featureType) {
        return this.featureColors[featureType] || this.featureColors['unknown'];
    }
}

// Enhanced visualization function that integrates with your existing visualize.js
export function enhancedVisualize(openCascade, importedData, castingAnalysis = null) {
    // Use your existing visualize function
    const result = visualize(openCascade, importedData);
    
    // If we have casting analysis results, apply feature colors
    if (castingAnalysis && castingAnalysis.face_colors) {
        result.geometries.forEach((geometry, index) => {
            const faceIndex = geometry.userData.faceIndex || (index + 1);
            
            // Get the feature type for this face from FreeCAD analysis
            const featureType = getFaceFeatureType(faceIndex, castingAnalysis);
            
            // Store feature information in geometry userData
            geometry.userData.featureType = featureType;
            geometry.userData.castingAnalysis = true;
        });
    }
    
    return result;
}

// Helper function to determine feature type from FreeCAD analysis
function getFaceFeatureType(faceIndex, castingAnalysis) {
    // Check if this face is classified in any feature
    for (const feature of castingAnalysis.features) {
        if (feature.face_indices && feature.face_indices.includes(faceIndex)) {
            return feature.type;
        }
    }
    return 'unknown';
}

// Enhanced addShapeToScene function with casting analysis integration
export async function addShapeToSceneWithCasting(openCascade, shapeData, scene, castingService = null, currentFile = null) {
    // Remove existing shape
    const existingShape = scene.getObjectByName("shape");
    if (existingShape) {
        scene.remove(existingShape);
    }

    // Check if we're passing a shape or imported data with face mapping
    let result;
    if (shapeData.shape && shapeData.faceMap) {
        // We're passing imported data with face mapping
        result = visualize(openCascade, shapeData);
    } else {
        // We're passing a plain shape (legacy support)
        result = {
            geometries: visualize(openCascade, shapeData),
            faceMap: null
        };
    }

    // Try to get casting analysis if service is available and file is provided
    let castingAnalysis = null;
    if (castingService && castingService.isAvailable && currentFile) {
        try {
            console.log('Running casting analysis...');
            castingAnalysis = await castingService.analyzeCasting(currentFile);
            console.log('Casting analysis completed:', castingAnalysis);
        } catch (error) {
            console.warn('Casting analysis failed:', error);
        }
    }

    // Create a group to hold all meshes
    const group = new THREE.Group();
    group.name = "shape";

    // Create individual meshes for each geometry
    result.geometries.forEach((geometry, index) => {
        // Store the face index in the geometry's userData
        geometry.userData = geometry.userData || {};
        geometry.userData.faceIndex = geometry.userData.faceIndex || (index + 1);

        // Determine color based on casting analysis or use default
        let materialColor = 0x909090; // Default gray
        let featureType = 'unknown';

        if (castingAnalysis) {
            const faceIndex = geometry.userData.faceIndex;
            featureType = getFaceFeatureType(faceIndex, castingAnalysis);
            materialColor = castingService.getFeatureColor(featureType);
            
            // Store casting analysis data
            geometry.userData.featureType = featureType;
            geometry.userData.castingAnalysis = castingAnalysis;
            
            // Find feature details for this face
            const feature = castingAnalysis.features.find(f => 
                f.face_indices && f.face_indices.includes(faceIndex)
            );
            if (feature) {
                geometry.userData.featureData = feature;
            }
        }

        // Create material with appropriate color
        const material = new THREE.MeshStandardMaterial({
            color: materialColor,
            metalness: 0.3,
            roughness: 0.4
        });

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.faceIndex = geometry.userData.faceIndex;
        mesh.userData.featureType = featureType;
        mesh.userData.originalColor = materialColor;

        group.add(mesh);
    });

    // Apply rotation to the entire group
    group.rotation.x = -Math.PI / 2;

    // Store analysis results and face map in the group
    group.userData.faceMap = result.faceMap;
    group.userData.castingAnalysis = castingAnalysis;

    // Add the group to the scene
    scene.add(group);

    return {
        group: group,
        castingAnalysis: castingAnalysis
    };
}

// Enhanced face selection handler with casting analysis integration
export function createCastingAwareFaceSelector(scene, camera, castingService) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    return async function handleFaceSelection(event, viewport) {
        // Calculate normalized device coordinates
        const rect = viewport.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Set raycaster
        raycaster.setFromCamera(mouse, camera);

        // Get the shape group
        const group = scene.getObjectByName("shape");
        if (!group) return null;

        // Find intersections
        const intersects = raycaster.intersectObjects(group.children, true);
        if (intersects.length === 0) return null;

        const intersected = intersects[0].object;
        const faceIndex = intersected.userData.faceIndex;

        // Highlight selected face
        highlightSelectedFace(group, intersected);

        // Prepare face information
        const faceInfo = {
            faceIndex: faceIndex,
            featureType: intersected.userData.featureType || 'unknown',
            mesh: intersected,
            geometry: intersected.geometry
        };

        // Get detailed geometry from FreeCAD service if available
        if (castingService && castingService.isAvailable && castingService.currentAnalysis) {
            try {
                const detailedGeometry = await castingService.getFaceGeometry(faceIndex);
                faceInfo.detailedGeometry = detailedGeometry;
            } catch (error) {
                console.warn('Failed to get detailed face geometry:', error);
            }
        }

        // Get casting feature data if available
        if (intersected.userData.featureData) {
            faceInfo.featureData = intersected.userData.featureData;
        }

        return faceInfo;
    };
}

// Helper function to highlight selected face
function highlightSelectedFace(group, selectedMesh) {
    // Reset all faces to original color
    group.children.forEach(child => {
        if (child.userData.originalColor !== undefined) {
            child.material.color.setHex(child.userData.originalColor);
        }
    });

    // Highlight selected face
    selectedMesh.material.color.setHex(0x00ff00); // Green highlight
}

// UI update functions for casting analysis results
export class CastingAnalysisUI {
    constructor() {
        this.infoPanel = document.getElementById('info-panel');
        this.setupInfoPanel();
    }

    setupInfoPanel() {
        // Ensure info panel exists or create it
        if (!this.infoPanel) {
            this.infoPanel = document.createElement('div');
            this.infoPanel.id = 'info-panel';
            this.infoPanel.className = 'info-panel';
            document.body.appendChild(this.infoPanel);
        }
    }

    updateFaceInfo(faceInfo) {
        const { faceIndex, featureType, detailedGeometry, featureData } = faceInfo;

        let html = `
            <div class="info-header">Face Analysis</div>
            <div class="info-section">
                <div class="info-item">
                    <span class="info-label">Face Index:</span>
                    <span class="info-value">${faceIndex}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Feature Type:</span>
                    <span class="info-value feature-${featureType}">${featureType}</span>
                </div>
        `;

        if (detailedGeometry) {
            html += `
                <div class="info-item">
                    <span class="info-label">Surface Type:</span>
                    <span class="info-value">${detailedGeometry.face_type}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Area:</span>
                    <span class="info-value">${detailedGeometry.area.toFixed(2)} mm²</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Center:</span>
                    <span class="info-value">
                        (${detailedGeometry.center[0].toFixed(1)}, 
                         ${detailedGeometry.center[1].toFixed(1)}, 
                         ${detailedGeometry.center[2].toFixed(1)})
                    </span>
                </div>
            `;

            if (detailedGeometry.radius) {
                html += `
                    <div class="info-item">
                        <span class="info-label">Radius:</span>
                        <span class="info-value">${detailedGeometry.radius.toFixed(2)} mm</span>
                    </div>
                `;
            }

            if (detailedGeometry.normal) {
                html += `
                    <div class="info-item">
                        <span class="info-label">Normal:</span>
                        <span class="info-value">
                            (${detailedGeometry.normal[0].toFixed(2)}, 
                             ${detailedGeometry.normal[1].toFixed(2)}, 
                             ${detailedGeometry.normal[2].toFixed(2)})
                        </span>
                    </div>
                `;
            }
        }

        if (featureData) {
            html += `
                <div class="info-section">
                    <div class="section-header">Feature Details</div>
                    <div class="info-item">
                        <span class="info-label">Confidence:</span>
                        <span class="info-value">${(featureData.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Total Area:</span>
                        <span class="info-value">${featureData.properties.total_area.toFixed(2)} mm²</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Face Count:</span>
                        <span class="info-value">${featureData.properties.face_count}</span>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        this.infoPanel.innerHTML = html;
        this.showPanel();
    }

    updateAnalysisSummary(analysisResults) {
        // Group features by type
        const featureGroups = {};
        analysisResults.features.forEach(feature => {
            if (!featureGroups[feature.type]) {
                featureGroups[feature.type] = [];
            }
            featureGroups[feature.type].push(feature);
        });

        let html = `
            <div class="info-header">Casting Analysis Summary</div>
            <div class="analysis-stats">
                <div class="stat-item">
                    <span class="stat-label">Total Faces:</span>
                    <span class="stat-value">${analysisResults.total_faces}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Classified:</span>
                    <span class="stat-value">${analysisResults.classified_faces}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Features Found:</span>
                    <span class="stat-value">${analysisResults.features.length}</span>
                </div>
            </div>
            <div class="feature-breakdown">
        `;

        Object.entries(featureGroups).forEach(([type, features]) => {
            const avgConfidence = features.reduce((sum, f) => sum + f.confidence, 0) / features.length;
            const totalFaces = features.reduce((sum, f) => sum + f.face_count, 0);

            html += `
                <div class="feature-group">
                    <div class="feature-header">
                        <span class="feature-name feature-${type}">${type}</span>
                        <span class="feature-count">${features.length}</span>
                    </div>
                    <div class="feature-details">
                        <span>Confidence: ${(avgConfidence * 100).toFixed(1)}%</span>
                        <span>Faces: ${totalFaces}</span>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        this.infoPanel.innerHTML = html;
        this.showPanel();
    }

    showPanel() {
        this.infoPanel.classList.add('visible');
    }

    hidePanel() {
        this.infoPanel.classList.remove('visible');
    }
}

// Export utility functions for easy integration
export {
    FreeCADCastingService as default,
    enhancedVisualize,
    addShapeToSceneWithCasting,
    createCastingAwareFaceSelector,
    CastingAnalysisUI
};