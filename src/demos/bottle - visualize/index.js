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
import { makeBottle, setupThreeJSViewport } from '../bottle - basic/library';
import visualize, { importSTEP } from '../../common/visualize';

// Modified to handle the new structure with face mapping
const addShapeToScene = async (openCascade, shapeData, scene) => {
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
  
  return group;
};

// New function to handle file loading with importSTEP
const loadSTEPFile = async (openCascade, file, callback, scene) => {
  try {
    // Read the file as text (matching the original loadFileAsync pattern)
    const fileText = await new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
    
    // Use the new importSTEP function to get shape and face mapping
    const importedData = importSTEP(openCascade, fileText);
    
    if (importedData.shape && !importedData.shape.IsNull()) {
      console.log(`Successfully imported model with ${importedData.faceMap.size} faces`);
      
      // Out with the old, in with the new!
      scene.remove(scene.getObjectByName("shape"));
      
      // Call the callback with the imported data instead of just the shape
      if (callback) {
        await callback(openCascade, importedData, scene);
      }
      
      console.log(file.name + " triangulated and added to the scene!");
    } else {
      console.error("Failed to import valid shape from STEP file");
    }
  } catch (error) {
    console.error('Error loading STEP file:', error);
  }
};

const scene = setupThreeJSViewport();

initOpenCascade().then(openCascade => {
  // Allow users to upload STEP Files by either "File Selector" or "Drag and Drop".
  document.getElementById("step-file").addEventListener(
    'input', async (event) => { 
      await loadSTEPFile(openCascade, event.srcElement.files[0], addShapeToScene, scene); 
    });
    
  document.body.addEventListener("dragenter", (e) => { e.stopPropagation(); e.preventDefault(); }, false);
  document.body.addEventListener("dragover", (e) => { e.stopPropagation(); e.preventDefault(); }, false);
  document.body.addEventListener("drop", (e) => {
    e.stopPropagation(); e.preventDefault();
    if (e.dataTransfer.files[0]) { 
      loadSTEPFile(openCascade, e.dataTransfer.files[0], addShapeToScene, scene); 
    }
  }, false);
  
// Example of face selection when clicking on a face
document.addEventListener('click', (event) => {
  // Get the element that was clicked
  const viewport = document.getElementById("viewport");
  
  // Only proceed if the click was within the viewport
  if (viewport.contains(event.target)) {
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
          
          console.log(`Selected face #${faceIndex}`, {
            face: group.userData.faceMap ? group.userData.faceMap.get(faceIndex)?.face : null,
            geometry: intersected.geometry
          });
          
          // You could highlight the face, show properties, etc.
          // Example: Change the color of the selected face
          if (intersected.material) {
            // Store the original color if not already stored
            if (!intersected.userData.originalColor) {
              intersected.userData.originalColor = intersected.material.color.clone();
            }
            
            // Reset all materials to original color
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
});
  
  let width = 50, height = 70, thickness = 30;
  let bottle = makeBottle(openCascade, width, height, thickness);
  
  // For the bottle, we're still using the legacy approach (direct shape)
  addShapeToScene(openCascade, bottle, scene);

  window.changeSliderWidth = value => {
    width = parseInt(value);
    scene.remove(scene.getObjectByName("shape"));
    let bottle = makeBottle(openCascade, width, height, thickness);
    const now = Date.now();
    addShapeToScene(openCascade, bottle, scene);
    console.log(Date.now() - now);
  };
  
  window.changeSliderHeight = value => {
    height = parseInt(value);
    scene.remove(scene.getObjectByName("shape"));
    let bottle = makeBottle(openCascade, width, height, thickness);
    addShapeToScene(openCascade, bottle, scene);
  };
  
  window.changeSliderThickness = value => {
    thickness = parseInt(value);
    scene.remove(scene.getObjectByName("shape"));
    let bottle = makeBottle(openCascade, width, height, thickness);
    addShapeToScene(openCascade, bottle, scene);
  };
});