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

const loadFileAsync = (file) => {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  })
}



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



