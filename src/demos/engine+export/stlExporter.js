// debugStlExporter.js - Debugging version of the STL exporter
// This file provides functionality to export Three.js 3D models as STL files
// with extensive debugging and troubleshooting capabilities

// Import required Three.js components
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'; // The official Three.js STL exporter
import { Group, Mesh } from 'three'; // Basic Three.js components for 3D object manipulation

/**
 * Creates a new Three.js group containing only the meshes from the specified physical group
 * 
 * This function performs the critical task of isolating specific geometry from the complete 3D model
 * based on a named selection group. It essentially filters the complete scene to extract only
 * the parts that belong to the requested group.
 * 
 * @param {Map} physicalGroups - Map containing all physical groups where:
 *                              - keys are group names (strings)
 *                              - values are arrays of face indices belonging to that group
 * @param {string} groupName - Name of the group to extract from the complete model
 * @param {Object} scene - Three.js scene containing the full 3D model
 * @returns {Group} A new group containing only the meshes for the specified group, or null if extraction fails
 */
function createGroupFromSelection(physicalGroups, groupName, scene) {
  // Log detailed debug information about the function arguments
  console.log("Debug - Creating group from selection:", {
    groupName, // The name of the group we're trying to extract
    hasPhysicalGroups: physicalGroups ? true : false, // Verify physicalGroups exists
    physicalGroupsSize: physicalGroups ? physicalGroups.size : 0, // How many groups are defined
    hasScene: scene ? true : false, // Verify scene exists
    groupExists: physicalGroups && physicalGroups.has(groupName) // Verify the requested group exists
  });

  // Validate that physicalGroups exists
  if (!physicalGroups) {
    console.error("physicalGroups is null or undefined");
    return null;
  }

  // Validate that the requested group exists in our physicalGroups map
  if (!physicalGroups.has(groupName)) {
    console.error(`Group "${groupName}" not found in physicalGroups. Available groups:`, 
      Array.from(physicalGroups.keys())); // Show all available groups to aid troubleshooting
    return null;
  }

  // Retrieve the array of face indices for this group
  const faceIndices = physicalGroups.get(groupName);
  console.log(`Debug - Face indices for ${groupName}:`, faceIndices);

  // Validate that face indices exist and aren't empty
  if (!faceIndices || faceIndices.length === 0) {
    console.error(`No face indices found for group "${groupName}"`);
    return null;
  }

  // Find the main model container in the scene (assumed to be named "shape")
  const modelGroup = scene.getObjectByName("shape");
  
  // Validate that the model group exists in the scene
  if (!modelGroup) {
    console.error("No model group found in scene with name 'shape'");
    // Log all available objects in the scene to help with debugging
    console.log("Available objects in scene:", scene.children.map(child => child.name || 'unnamed'));
    return null;
  }

  // Log information about the model group to verify its structure
  console.log("Debug - Model group found:", {
    name: modelGroup.name,
    childCount: modelGroup.children.length, // How many mesh parts are in the model
    hasFaceMap: modelGroup.userData && modelGroup.userData.faceMap ? true : false // Whether the face mapping data exists
  });

  // Create a new group to hold only the selected faces/parts
  const exportGroup = new Group();
  exportGroup.name = groupName; // Name the group after the selection for clarity
  
  // Process each face index in the selection
  // This loop finds each face in the model and adds a copy to our export group
  faceIndices.forEach(faceIndex => {
    // Find the mesh in the model that corresponds to this face index
    const sourceMesh = modelGroup.children.find(child => 
      child.userData && child.userData.faceIndex === faceIndex);
    
    // Log detailed information about the search for each face
    console.log(`Debug - Looking for face #${faceIndex}:`, {
      found: sourceMesh ? true : false, // Whether the face was found
      geometryExists: sourceMesh && sourceMesh.geometry ? true : false // Whether the face has geometry
    });
    
    // If the face was found, clone it and add to our export group
    if (sourceMesh) {
      try {
        // Clone the geometry and material to avoid modifying the original
        const clonedGeometry = sourceMesh.geometry.clone();
        const clonedMaterial = sourceMesh.material.clone();
        
        // Create a new mesh with the cloned components
        const clonedMesh = new Mesh(clonedGeometry, clonedMaterial);
        
        // Copy the transformation from the original to maintain positioning
        clonedMesh.position.copy(sourceMesh.position);
        clonedMesh.rotation.copy(sourceMesh.rotation);
        clonedMesh.scale.copy(sourceMesh.scale);
        
        // Add the cloned mesh to our export group
        exportGroup.add(clonedMesh);
        console.log(`Debug - Added face #${faceIndex} to export group`);
      } catch (error) {
        // Log any errors that occur during cloning (like geometry is null)
        console.error(`Failed to clone mesh for face #${faceIndex}:`, error);
      }
    }
  });
  
  // Log summary of the export group creation
  console.log(`Debug - Created export group with ${exportGroup.children.length} faces`);
  
  // Validate that we actually added meshes to our export group
  if (exportGroup.children.length === 0) {
    console.error("No faces were added to the export group");
    return null;
  }
  
  // Apply the parent group's transformation to maintain the model's orientation
  // This ensures the exported STL has the same rotation as the original model
  if (modelGroup.rotation) {
    exportGroup.rotation.x = modelGroup.rotation.x;
    exportGroup.rotation.y = modelGroup.rotation.y;
    exportGroup.rotation.z = modelGroup.rotation.z;
    console.log("Debug - Applied rotation to export group");
  }
  
  // Return the completed export group containing only the selected meshes
  return exportGroup;
}

/**
 * Exports a selected group as an STL file with detailed debug logging
 * 
 * This function coordinates the process of extracting and exporting a specific
 * group from the 3D model as an STL file, either in binary or ASCII format.
 * 
 * @param {Map} physicalGroups - Map containing all physical groups
 * @param {string} groupName - Name of the group to export
 * @param {Object} scene - Three.js scene containing the full model
 * @param {boolean} binary - Whether to export as binary STL (true) or ASCII STL (false)
 * @returns {string|Uint8Array} STL data as string (ASCII) or Uint8Array (binary), or null if export fails
 */
export function exportGroupAsSTL(physicalGroups, groupName, scene, binary = true) {
  // Log detailed debug information about the export parameters
  console.log("Debug - Starting STL export:", {
    groupName, // The group we're trying to export
    binary, // Whether we're exporting as binary or ASCII
    sceneExists: scene ? true : false, // Verify scene exists
    physicalGroupsExists: physicalGroups ? true : false // Verify physicalGroups exists
  });
  
  // Create a group containing only the meshes from the specified selection
  const groupToExport = createGroupFromSelection(physicalGroups, groupName, scene);
  
  // Validate that group creation was successful
  if (!groupToExport) {
    console.error(`Failed to create group for export: ${groupName}`);
    return null;
  }
  
  // Log information about the created group to verify its structure
  console.log(`Debug - Group created for STL export:`, {
    name: groupToExport.name,
    childCount: groupToExport.children.length // How many mesh parts are in the export group
  });
  
  try {
    // Initialize the STL exporter from Three.js
    const exporter = new STLExporter();
    console.log("Debug - STL exporter created");
    
    // Export the group to STL format (binary or ASCII)
    const stlData = exporter.parse(groupToExport, { binary });
    console.log(`Debug - STL data generated: ${binary ? 'binary' : 'ASCII'} format`);
    
    // Log the size of the generated STL data
    if (binary && stlData) {
      console.log(`Debug - STL data size: ${stlData.byteLength} bytes`);
    } else if (stlData) {
      console.log(`Debug - STL data length: ${stlData.length} characters`);
    }
    
    // Return the STL data for saving or further processing
    return stlData;
  } catch (error) {
    // Log any errors that occur during the export process
    console.error("Error during STL export:", error);
    return null;
  }
}

/**
 * Saves STL data to a file and triggers browser download
 * 
 * This function takes the STL data generated by exportGroupAsSTL and creates
 * a downloadable file in the browser.
 * 
 * @param {string|Uint8Array} stlData - The STL data to save (string for ASCII, Uint8Array for binary)
 * @param {string} filename - Name for the downloaded file
 * @param {boolean} binary - Whether the data is binary (true) or ASCII (false)
 */
export function saveSTL(stlData, filename, binary = true) {
  // Log detailed debug information about the save parameters
  console.log("Debug - Saving STL:", {
    filename, // The name for the saved file
    binary, // Whether we're saving binary or ASCII format
    dataExists: stlData ? true : false, // Verify stlData exists
    dataType: stlData ? (binary ? 'Uint8Array' : 'string') : 'none' // What type of data we're saving
  });
  
  // Validate that STL data exists
  if (!stlData) {
    console.error("No STL data provided to save");
    return;
  }
  
  try {
    // Create the appropriate blob type based on binary or ASCII format
    // Binary STL uses application/octet-stream MIME type
    // ASCII STL uses text/plain MIME type
    const blob = binary 
      ? new Blob([stlData], { type: 'application/octet-stream' })
      : new Blob([stlData], { type: 'text/plain' });
    
    console.log(`Debug - Created blob of size ${blob.size} bytes`);
    
    // Create a URL for the blob that can be used for downloading
    const url = URL.createObjectURL(blob);
    console.log(`Debug - Created object URL: ${url}`);
    
    // Create an anchor element to trigger the download
    const link = document.createElement('a');
    link.href = url; // Set the URL to our blob
    // Ensure the filename has the .stl extension
    link.download = filename.endsWith('.stl') ? filename : `${filename}.stl`;
    
    // Append the link to the document body (required for Firefox)
    document.body.appendChild(link);
    console.log(`Debug - Added download link to document body`);
    
    // Programmatically click the link to start the download
    link.click();
    console.log(`Debug - Triggered download`);
    
    // Remove the link after a short delay and revoke the object URL to free memory
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log(`Debug - Cleaned up download resources`);
    }, 100); // 100ms delay gives enough time for the download to start
  } catch (error) {
    // Log any errors that occur during the save process
    console.error("Error saving STL file:", error);
  }
}

/**
 * Adds a troubleshooting button to the UI that logs detailed information
 * about the current selection state and model structure.
 * 
 * This function is particularly useful for debugging selection issues when
 * the export isn't working as expected.
 * 
 * @param {Object} selectionState - Object containing the current selection state
 * @param {Object} scene - Three.js scene containing the full model
 * @returns {HTMLElement} The created button element
 */
export function addTroubleshootingButton(selectionState, scene) {
  // Create a button element with styling to make it look like a warning/troubleshooting button
  const button = document.createElement('button');
  button.textContent = 'Troubleshoot Selection';
  button.style.backgroundColor = '#ffdddd'; // Light red background
  button.style.padding = '8px';
  button.style.margin = '5px 0';
  button.style.width = '100%';
  button.style.border = '1px solid #ff0000'; // Red border
  
  // Add click event listener to perform troubleshooting when clicked
  button.addEventListener('click', () => {
    console.log("===== SELECTION STATE TROUBLESHOOTING =====");
    // Log general information about the selection state
    console.log("Selection state:", {
      mode: selectionState.mode, // Current selection mode
      inSelectionMode: selectionState.inSelectionMode, // Whether selection mode is active
      selectedFacesCount: selectionState.selectedFaces ? selectionState.selectedFaces.size : 0, // How many faces are selected
      physicalGroupsCount: selectionState.physicalGroups ? selectionState.physicalGroups.size : 0 // How many groups are defined
    });
    
    // Log detailed information about each physical group
    if (selectionState.physicalGroups && selectionState.physicalGroups.size > 0) {
      console.log("Physical groups:");
      selectionState.physicalGroups.forEach((faces, name) => {
        console.log(`- ${name}: ${faces.length || 0} faces`); // Group name and face count
      });
    }
    
    // Find the main model container in the scene (assumed to be named "shape")
    const modelGroup = scene.getObjectByName("shape");
    if (modelGroup) {
      // Log detailed information about the model structure
      console.log("Model information:", {
        childCount: modelGroup.children.length, // How many mesh parts are in the model
        hasFaceMap: modelGroup.userData && modelGroup.userData.faceMap ? true : false, // Whether face mapping exists
        faceMapSize: modelGroup.userData && modelGroup.userData.faceMap ? 
          modelGroup.userData.faceMap.size : 0 // How many entries are in the face map
      });
      
      // Log a sample of face map entries to help with debugging
      if (modelGroup.userData && modelGroup.userData.faceMap) {
        console.log("First 5 face map entries:");
        let count = 0;
        modelGroup.userData.faceMap.forEach((value, key) => {
          if (count < 5) {
            console.log(`- Face #${key}:`, value);
            count++;
          }
        });
      }
    } else {
      console.log("No model group found in scene");
    }
    
    // Log detailed information about the model's children (individual meshes)
    console.log("=== CHILDREN IN MODEL ===");
    if (modelGroup && modelGroup.children.length > 0) {
      console.log(`First 5 children (of ${modelGroup.children.length}):`);
      for (let i = 0; i < Math.min(5, modelGroup.children.length); i++) {
        const child = modelGroup.children[i];
        console.log(`Child #${i}:`, {
          type: child.type, // Type of the child (should be "Mesh")
          hasFaceIndex: child.userData && child.userData.faceIndex ? true : false, // Whether face index is defined
          faceIndex: child.userData ? child.userData.faceIndex : undefined, // The face index value
          hasGeometry: child.geometry ? true : false // Whether geometry exists
        });
      }
    }
    
    console.log("====================================");
    // Show an alert to inform the user where to find the logged information
    alert("Troubleshooting information logged to console. Press F12 to view.");
  });
  
  // Append the button to a container element or the document body
  // First tries to find a specific export container, falls back to document.body
  const container = document.querySelector('.export-container') || document.body;
  container.appendChild(button);
  
  return button;
}

// Make key functions available globally for debugging through the browser console
// This allows manual testing and troubleshooting from the developer console
window.exportGroupAsSTL = exportGroupAsSTL;
window.saveSTL = saveSTL;