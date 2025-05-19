import initOpenCascade from "opencascade.js";
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  Group,
  Raycaster,
  Vector2,
  PerspectiveCamera
} from 'three';
import { setupThreeJSViewport } from './library.js';
import visualize, { importSTEP } from '../../common/visualize.js';
import { loadSTEPFile } from "./library.js";
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { 
  fixSelectionState, 
  validateFaceIndices, 
  validateSceneMeshes,
  backupSelectionState
} from './fixes.js';
import { setupServerStorage } from './serverStorage.js';

console.log("Imports completed, serverStorage module:", typeof setupServerStorage);

const scene = setupThreeJSViewport();
console.log("Scene setup completed");

// Add UI elements for selection mode
const uiContainer = document.createElement('div');
uiContainer.style.position = 'absolute';
uiContainer.style.top = '10px';
uiContainer.style.left = '10px';
uiContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
uiContainer.style.padding = '10px';
uiContainer.style.borderRadius = '5px';
uiContainer.style.display = 'none'; // Initially hidden until a model is loaded
document.body.appendChild(uiContainer);

// Create status/instruction element
const statusElement = document.createElement('div');
statusElement.id = 'selection-status';
statusElement.textContent = 'No model loaded';
uiContainer.appendChild(statusElement);

// Create selection mode indicator
const selectionModeElement = document.createElement('div');
selectionModeElement.id = 'selection-mode';
selectionModeElement.textContent = '';
uiContainer.appendChild(selectionModeElement);

// Create selection counter for multiple selection
const selectionCountElement = document.createElement('div');
selectionCountElement.id = 'selection-count';
selectionCountElement.textContent = '';
uiContainer.appendChild(selectionCountElement);

// Current selection state
let selectionState = {
  mode: null, // 'inlet', 'outlet', etc.
  selectedFaces: new Set(),
  physicalGroups: new Map(), // Map to store named groups of faces
  inSelectionMode: false
};

// Define the confirmSelection function separately
function confirmSelection() {
  if (!selectionState.inSelectionMode || selectionState.selectedFaces.size === 0) return;
  
  // Store the selection as a physical group
  selectionState.physicalGroups.set(selectionState.mode, Array.from(selectionState.selectedFaces));
  
  // Display confirmation
  statusElement.textContent = `${selectionState.mode} group created with ${selectionState.selectedFaces.size} faces`;
  
  console.log(`Created physical group '${selectionState.mode}' with faces:`, 
    Array.from(selectionState.selectedFaces));
  
  // Reset selection state
  selectionState.inSelectionMode = false;
  selectionModeElement.textContent = 'Selection mode: Inactive';
  selectionCountElement.textContent = '';
  
  // Keep the colors for the group we just defined
  setTimeout(() => {
    if (!selectionState.inSelectionMode) {
      statusElement.textContent = 'Press "I" for inlet, "O" for outlet, or "W" for wall selection';
    }
  }, 2000);
}

// Attach the function to the selectionState object
selectionState.confirmSelection = confirmSelection;

console.log("Selection state initialized:", selectionState);

// Helper function to start a new selection sequence
function startSelection(groupName) {
  selectionState.mode = groupName;
  selectionState.selectedFaces.clear();
  selectionState.inSelectionMode = true;
  selectionModeElement.textContent = `Currently selecting: ${groupName}`;
  selectionCountElement.textContent = 'Selected: 0 faces';
  statusElement.textContent = `Select faces for ${groupName}, then press Enter to confirm`;
  
  // Show UI container when selection starts
  uiContainer.style.display = 'block';
  
  // Reset any previously colored faces
  const group = scene.getObjectByName("shape");
  if (group) {
    group.children.forEach(child => {
      if (child.userData.originalColor) {
        child.material.color.copy(child.userData.originalColor);
      }
    });
  }
}

// Function to add a face to the current selection
function addFaceToSelection(faceIndex, mesh) {
  if (!selectionState.inSelectionMode) return;
  
  if (selectionState.selectedFaces.has(faceIndex)) {
    // Deselect if already selected
    selectionState.selectedFaces.delete(faceIndex);
    // Reset color
    if (mesh.userData.originalColor) {
      mesh.material.color.copy(mesh.userData.originalColor);
    }
  } else {
    // Add to selection
    selectionState.selectedFaces.add(faceIndex);
    // Change color to highlight selection
    if (!mesh.userData.originalColor) {
      mesh.userData.originalColor = mesh.material.color.clone();
    }
    mesh.material.color.set(0x00ff00); // Green for selected face
  }
  
  // Update selection count
  selectionCountElement.textContent = `Selected: ${selectionState.selectedFaces.size} faces`;
}

// Add keyboard event listeners
document.addEventListener('keydown', (event) => {
  // Enter key to confirm selection
  if (event.key === 'Enter' && selectionState.inSelectionMode) {
    selectionState.confirmSelection();
    console.log("Selection confirmed via Enter key");
  }
  
  // Shortcut keys to start different selection modes
  if (event.key === 'i' || event.key === 'I') {
    startSelection('inlet');
  } else if (event.key === 'o' || event.key === 'O') {
    startSelection('outlet');
  } else if (event.key === 'w' || event.key === 'W') {
    startSelection('wall');
  }
});

// Function to add shape to scene (defined before it's used)
let addShapeToScene = async (openCascade, shapeData, scene) => {
  console.log("Adding shape to scene");
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
  
  // Create a group to hold all meshes
  const group = new Group();
  group.name = "shape";
  
  // Create individual meshes for each geometry, preserving face mapping
  result.geometries.forEach((geometry, index) => {
    // Store the face index in the geometry's userData
    geometry.userData = geometry.userData || {};
    // Use the index+1 as the faceIndex if it doesn't already exist
    geometry.userData.faceIndex = geometry.userData.faceIndex || (index + 1);
    
    // Create a material that can be individually colored
    const objectMat = new MeshStandardMaterial({
      color: new Color(0.9, 0.9, 0.9)
    });
    
    // Create mesh with the geometry and material
    const mesh = new Mesh(geometry, objectMat);
    
    // Transfer the face index to the mesh's userData as well
    mesh.userData.faceIndex = geometry.userData.faceIndex;
    
    // Add the mesh to the group
    group.add(mesh);
  });
  
  // Apply rotation to the entire group
  group.rotation.x = -Math.PI / 2;
  
  // Store the face map in the group for later reference
  group.userData.faceMap = result.faceMap;
  
  // Add the group to the scene
  scene.add(group);
  
  // Update UI to show selection options
  statusElement.textContent = 'Model loaded. Press "I" for inlet, "O" for outlet, or "W" for wall selection';
  uiContainer.style.display = 'block';
  
  return group;
};

let openCascadeInstance = null; // Store OpenCascade instance globally

// Function to check and load uploaded model
async function checkAndLoadUploadedModel(openCascade) {
  console.log("Checking for uploaded model...");
  
  try {
    const modelDataStr = sessionStorage.getItem('pendingCADModel');
    
    if (modelDataStr) {
      const modelData = JSON.parse(modelDataStr);
      
      console.log("Found uploaded model metadata:", modelData.name);
      statusElement.textContent = `Loading: ${modelData.name}`;
      
      // Create a file from the blob URL
      const response = await fetch(modelData.blobUrl);
      const blob = await response.blob();
      const file = new File([blob], modelData.name, { type: modelData.type });
      
      // Clean up the blob URL
      URL.revokeObjectURL(modelData.blobUrl);
      
      // Remove the pending model data
      sessionStorage.removeItem('pendingCADModel');
      
      // Load the file
      await loadSTEPFile(openCascade, file, addShapeToScene, scene);
      
      console.log("Model loaded successfully");
    } else {
      console.log("No pending model data found");
      statusElement.textContent = 'No model uploaded. Use the file selector below.';
    }
  } catch (error) {
    console.error("Error loading uploaded model:", error);
    statusElement.textContent = 'Error loading uploaded model. Use the file selector below.';
  }
}

// Export to STL function
function exportToSTL() {
  const group = scene.getObjectByName("shape");
  if (!group) {
    alert("No model to export");
    return;
  }
  
  const exporter = new STLExporter();
  const stlString = exporter.parse(group);
  
  // Create a blob and trigger download
  const blob = new Blob([stlString], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'model.stl';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Function to go back to upload page
function goToUploadPage() {
  window.location.href = '../../index.html';
}

initOpenCascade().then(openCascade => {
  console.log("OpenCascade initialized");

  // Store the OpenCascade instance for later use
  window.openCascadeInstance = openCascade;
  openCascadeInstance = openCascade; // Also store locally for use in this module
  console.log("OpenCascade instance stored globally for reference");
  
  // Check for uploaded model first
  checkAndLoadUploadedModel(openCascade);

  // Allow users to upload STEP Files by either "File Selector" or "Drag and Drop".
  document.getElementById("step-file").addEventListener(
    'input', async (event) => { 
      console.log("File input triggered");
      await loadSTEPFile(openCascade, event.srcElement.files[0], addShapeToScene, scene); 
    });
    
  document.body.addEventListener("dragenter", (e) => { e.stopPropagation(); e.preventDefault(); }, false);
  document.body.addEventListener("dragover", (e) => { e.stopPropagation(); e.preventDefault(); }, false);
  document.body.addEventListener("drop", (e) => {
    e.stopPropagation(); e.preventDefault();
    console.log("File drop triggered");
    if (e.dataTransfer.files[0]) { 
      loadSTEPFile(openCascade, e.dataTransfer.files[0], addShapeToScene, scene); 
    }
  }, false);
  
  // Face selection when clicking on a face
  document.addEventListener('click', (event) => {
    // Get the element that was clicked
    const viewport = document.getElementById("viewport");
    
    // Only proceed if the click was within the viewport
    if (viewport && viewport.contains(event.target)) {
      // Calculate normalized device coordinates (-1 to +1)
      const rect = viewport.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Create a raycaster to detect which object was clicked
      const raycaster = new Raycaster();
      // Get the camera from the scene
      const camera = Array.from(scene.children).find(child => child instanceof PerspectiveCamera);
      
      if (camera) {
        // Set the raycaster based on mouse position and camera
        raycaster.setFromCamera(new Vector2(x, y), camera);
        
        // Get the shape group that contains all the faces
        const group = scene.getObjectByName("shape");
        
        if (group) {
          // Find all intersections with the shape's children (individual face meshes)
          const intersects = raycaster.intersectObjects(group.children, true);
          
          if (intersects.length > 0) {
            // Get the first intersection (closest to camera)
            const intersected = intersects[0].object;
            
            // Get the face index from the intersected object's userData
            const faceIndex = intersected.userData.faceIndex || 
                           (intersected.geometry.userData && intersected.geometry.userData.faceIndex);
            
            console.log(`Clicked on face #${faceIndex}`);
            
            // If in selection mode, add to or remove from current selection
            if (selectionState.inSelectionMode) {
              addFaceToSelection(faceIndex, intersected);
            } else {
              // Just highlight the face if not in selection mode
              if (intersected.material) {
                // Store the original color if not already stored
                if (!intersected.userData.originalColor) {
                  intersected.userData.originalColor = intersected.material.color.clone();
                }
                
                // Reset all materials to original color first
                group.children.forEach(child => {
                  if (child.userData.originalColor && child !== intersected) {
                    child.material.color.copy(child.userData.originalColor);
                  }
                });
                
                // Set the new color for the selected face
                intersected.material.color.set(0x00ff00); // Green for selected face
              }
            }
          }
        }
      }
    }
  });
  
  // Rest of the initialization code remains the same...
  console.log("Setting up selection state fix...");
  const fixedState = fixSelectionState(selectionState);
  Object.assign(selectionState, fixedState);
  
  console.log("Setting up enhanced addShapeToScene...");
  const originalAddShapeToScene = addShapeToScene;
  addShapeToScene = async function(openCascade, shapeData, scene) {
    const result = await originalAddShapeToScene(openCascade, shapeData, scene);
    validateSceneMeshes(scene);
    return result;
  };
  
  console.log("Setting up enhanced confirmSelection...");
  const originalConfirmSelection = selectionState.confirmSelection;
  const enhancedConfirmSelection = function() {
    console.log("Enhanced confirmSelection called");
    const facesArray = Array.from(selectionState.selectedFaces);
    selectionState.physicalGroups.set(selectionState.mode, facesArray);
    originalConfirmSelection();
    console.log(`Created group '${selectionState.mode}' with faces:`, facesArray);
    backupSelectionState(selectionState);
    validateFaceIndices(selectionState);
  };
  
  selectionState.confirmSelection = enhancedConfirmSelection;
  
  // Add export buttons to the UI container
  const exportContainer = document.createElement('div');
  exportContainer.style.marginTop = '10px';
  exportContainer.style.marginBottom = '10px';

  const exportToggles = document.createElement('div');
  exportToggles.style.display = 'flex';
  exportToggles.style.gap = '5px';
  exportToggles.style.marginBottom = '5px';

  const exportSTLBtn = document.createElement('button');
  exportSTLBtn.textContent = 'Export STL';
  exportSTLBtn.onclick = () => exportToSTL();
  exportToggles.appendChild(exportSTLBtn);

  const backBtn = document.createElement('button');
  backBtn.textContent = 'Upload New';
  backBtn.onclick = () => goToUploadPage();
  exportToggles.appendChild(backBtn);

  exportContainer.appendChild(exportToggles);
  uiContainer.appendChild(exportContainer);
  
  console.log("Setting up server storage...");
  try {
    setTimeout(() => {
      if (selectionState && scene) {
        const projectId = setupServerStorage(selectionState, scene, {
          serverEndpoint: '/api/store-stl',
          notifyUser: true,
          openCascade: openCascade
        });
        
        console.log(`Server storage initialized. Project ID: ${projectId}`);
        
        const projectInfoElement = document.createElement('div');
        projectInfoElement.style.position = 'absolute';
        projectInfoElement.style.top = '10px';
        projectInfoElement.style.right = '10px';
        projectInfoElement.style.backgroundColor = 'rgba(255,255,255,0.8)';
        projectInfoElement.style.padding = '5px 10px';
        projectInfoElement.style.borderRadius = '5px';
        projectInfoElement.style.fontSize = '12px';
        projectInfoElement.textContent = `Project ID: ${projectId}`;
        document.body.appendChild(projectInfoElement);
      } else {
        console.error("Failed to initialize server storage: selectionState or scene not available");
      }
    }, 500);
  } catch (error) {
    console.error("Failed to initialize server storage:", error);
  }
  
  console.log("OpenCascade initialization complete");
});

// Helper function to get faces from a physical group (useful for future operations)
function getFacesFromGroup(groupName) {
  if (!selectionState.physicalGroups.has(groupName)) {
    console.warn(`Physical group '${groupName}' does not exist`);
    return [];
  }
  
  const faceIndices = selectionState.physicalGroups.get(groupName);
  const group = scene.getObjectByName("shape");
  if (!group) return [];
  
  const faces = [];
  for (const faceIndex of faceIndices) {
    // Find the mesh for this face index
    const mesh = group.children.find(child => child.userData.faceIndex === faceIndex);
    if (mesh) {
      faces.push({
        mesh: mesh,
        faceIndex: faceIndex,
        // If you need the OpenCascade face object
        occtFace: group.userData.faceMap ? group.userData.faceMap.get(faceIndex)?.face : null
      });
    }
  }
  
  return faces;
}