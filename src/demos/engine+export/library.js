import {
  AmbientLight,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Color,
  Geometry,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import openCascadeHelper from '../../common/openCascadeHelper';
import { importSTEP } from '../../common/visualize';

const loadFileAsync = (file) => {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  })
}

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
  }
export{ addShapeToScene};




const setupThreeJSViewport = () => {
  var scene = new Scene();
  var camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  scene.add(camera);

  var renderer = new WebGLRenderer({ antialias: true });
  const viewport = document.getElementById("viewport");
  const viewportRect = viewport.getBoundingClientRect();
  renderer.setSize(viewportRect.width, viewportRect.height);
  viewport.appendChild(renderer.domElement);

  const light = new AmbientLight(0x404040);
  scene.add(light);
  const directionalLight = new DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0.5, 0.5, 0.5);
  scene.add(directionalLight);

  camera.position.set(0, 50, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.screenSpacePanning = true;
  controls.target.set(0, 50, 0);
  controls.update();

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
  return scene;
}
export { setupThreeJSViewport };

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
}
export { loadSTEPFile };





