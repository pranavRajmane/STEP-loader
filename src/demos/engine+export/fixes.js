// fixes.js - Additional fixes for selection state and confirmation issues

/**
 * Checks and fixes issues with the selection state structure
 * @param {Object} selectionState - The current selection state object
 * @returns {Object} The corrected selection state
 */
export function fixSelectionState(selectionState) {
    if (!selectionState) {
      console.error("Selection state is null or undefined");
      // Create a new one if missing
      selectionState = {
        mode: null,
        selectedFaces: new Set(),
        physicalGroups: new Map(),
        inSelectionMode: false
      };
    }
    
    // Ensure physicalGroups is a Map
    if (!selectionState.physicalGroups) {
      console.warn("physicalGroups not found in selection state, creating it");
      selectionState.physicalGroups = new Map();
    } else if (!(selectionState.physicalGroups instanceof Map)) {
      console.warn("physicalGroups is not a Map, converting it");
      const newMap = new Map();
      
      // Try to convert if it's a plain object
      if (typeof selectionState.physicalGroups === 'object') {
        Object.entries(selectionState.physicalGroups).forEach(([key, value]) => {
          newMap.set(key, value);
        });
      }
      
      selectionState.physicalGroups = newMap;
    }
    
    // Ensure selectedFaces is a Set
    if (!selectionState.selectedFaces) {
      console.warn("selectedFaces not found in selection state, creating it");
      selectionState.selectedFaces = new Set();
    } else if (!(selectionState.selectedFaces instanceof Set)) {
      console.warn("selectedFaces is not a Set, converting it");
      selectionState.selectedFaces = new Set(
        Array.isArray(selectionState.selectedFaces) 
          ? selectionState.selectedFaces 
          : []
      );
    }
    
    // Ensure the confirmSelection function exists
    if (typeof selectionState.confirmSelection !== 'function') {
      console.warn("confirmSelection function not found, adding it");
      selectionState.confirmSelection = function() {
        if (!this.inSelectionMode || this.selectedFaces.size === 0) return;
        
        // Store the selection as a physical group
        this.physicalGroups.set(this.mode, Array.from(this.selectedFaces));
        
        console.log(`Created physical group '${this.mode}' with faces:`, 
          Array.from(this.selectedFaces));
        
        // Reset selection state
        this.inSelectionMode = false;
        
        // Optional: update UI if those elements exist
        const statusElement = document.getElementById('selection-status');
        const selectionModeElement = document.getElementById('selection-mode');
        
        if (statusElement) {
          statusElement.textContent = `${this.mode} group created with ${this.selectedFaces.size} faces`;
        }
        
        if (selectionModeElement) {
          selectionModeElement.textContent = 'Selection mode: Inactive';
        }
      };
    }
    
    return selectionState;
  }
  
  /**
   * Ensures the face indices are stored correctly in the physical groups
   * @param {Object} selectionState - The selection state object
   */
  export function validateFaceIndices(selectionState) {
    if (!selectionState || !selectionState.physicalGroups) return;
    
    selectionState.physicalGroups.forEach((faceIndices, groupName) => {
      // Convert to array if it's a Set
      if (faceIndices instanceof Set) {
        console.log(`Converting face indices for ${groupName} from Set to Array`);
        selectionState.physicalGroups.set(groupName, Array.from(faceIndices));
      }
      
      // Log the faces in this group
      const faces = selectionState.physicalGroups.get(groupName);
      console.log(`Group ${groupName} contains ${faces.length} faces:`, faces);
    });
  }
  
  /**
   * Verifies that meshes in the scene have proper face indices
   * @param {Object} scene - The Three.js scene
   */
  export function validateSceneMeshes(scene) {
    const modelGroup = scene.getObjectByName("shape");
    if (!modelGroup) {
      console.error("No shape group found in scene");
      return;
    }
    
    console.log(`Validating ${modelGroup.children.length} meshes in scene`);
    
    // Count meshes with and without face indices
    let withIndex = 0;
    let withoutIndex = 0;
    
    modelGroup.children.forEach((mesh, i) => {
      if (!mesh.userData) {
        mesh.userData = {};
      }
      
      if (mesh.userData.faceIndex === undefined) {
        // Try to get it from geometry userData
        if (mesh.geometry && mesh.geometry.userData && mesh.geometry.userData.faceIndex) {
          mesh.userData.faceIndex = mesh.geometry.userData.faceIndex;
          console.log(`Copied face index ${mesh.userData.faceIndex} from geometry to mesh`);
          withIndex++;
        } else {
          // Assign a new index based on the mesh's position in the array
          mesh.userData.faceIndex = i + 1;
          console.log(`Assigned new face index ${mesh.userData.faceIndex} to mesh`);
          withoutIndex++;
        }
      } else {
        withIndex++;
      }
    });
    
    console.log(`Mesh validation: ${withIndex} meshes with face indices, ${withoutIndex} meshes needed new indices`);
  }
  
  /**
   * Creates a backup of selection data in localStorage
   * @param {Object} selectionState - The selection state to back up
   */
  export function backupSelectionState(selectionState) {
    try {
      if (!selectionState || !selectionState.physicalGroups) return;
      
      const backup = {};
      
      // Convert Map to object for storage
      backup.physicalGroups = {};
      selectionState.physicalGroups.forEach((faces, name) => {
        backup.physicalGroups[name] = Array.from(faces);
      });
      
      // Store current mode
      backup.mode = selectionState.mode;
      
      // Save to localStorage
      localStorage.setItem('selectionStateBackup', JSON.stringify(backup));
      console.log("Selection state backed up to localStorage");
    } catch (error) {
      console.error("Failed to backup selection state:", error);
    }
  }
  
  /**
   * Restores selection data from localStorage if available
   * @param {Object} selectionState - The selection state to update
   * @returns {boolean} True if restore was successful
   */
  export function restoreSelectionState(selectionState) {
    try {
      const backupJson = localStorage.getItem('selectionStateBackup');
      if (!backupJson) return false;
      
      const backup = JSON.parse(backupJson);
      
      // Ensure the structure is correct
      selectionState = fixSelectionState(selectionState);
      
      // Restore physical groups
      if (backup.physicalGroups) {
        Object.entries(backup.physicalGroups).forEach(([name, faces]) => {
          selectionState.physicalGroups.set(name, faces);
        });
      }
      
      // Restore mode
      if (backup.mode) {
        selectionState.mode = backup.mode;
      }
      
      console.log("Selection state restored from backup");
      return true;
    } catch (error) {
      console.error("Failed to restore selection state:", error);
      return false;
    }
  }