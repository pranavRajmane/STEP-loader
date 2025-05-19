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
  Group,
  Camera,
  PlaneGeometry,
  ShaderMaterial,
  BackSide
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
  // You need to import 'visualize' function
  // import { visualize } from '../../common/visualize';
  
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
  
  // Create gradient background
  const bgScene = new Scene();
  const bgCamera = new Camera();
  
  // Create gradient shader material
  const bgGeometry = new PlaneGeometry(2, 2);
  const bgMaterial = new ShaderMaterial({
    uniforms: {
      topColor: { value: new Color(0x000000) }, // Black
      bottomColor: { value: new Color(0xDC143C) }, // Ferrari Red
      offset: { value: 0.33 },
      exponent: { value: 0.6 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: BackSide
  });
  
  const bgMesh = new Mesh(bgGeometry, bgMaterial);
  bgScene.add(bgMesh);
  bgScene.add(bgCamera);
  
  // Updated camera with better clipping planes
  var camera = new PerspectiveCamera(
    75, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.01, // Near plane (reduced from 0.1 to see closer objects)
    10000 // Far plane (increased from 1000 to see farther objects)
  );
  scene.add(camera);
  
  var renderer = new WebGLRenderer({ antialias: true, alpha: true });
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
  
  // Optional: Add these controls for better camera behavior
  controls.enableDamping = true; // Smooth controls
  controls.dampingFactor = 0.05; // Damping strength
  controls.minDistance = 1; // Minimum zoom distance
  controls.maxDistance = 5000; // Maximum zoom distance
  controls.update();
  
  // Add window resize handler
  window.addEventListener('resize', () => {
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  });
  
  function animate() {
    requestAnimationFrame(animate);
    
    if (controls.enableDamping) {
      controls.update(); // Required if enableDamping or autoRotate is set
    }
    
    // Render background first
    renderer.render(bgScene, bgCamera);
    
    // Then render the main scene
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