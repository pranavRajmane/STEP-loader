import * as THREE from 'three'

// New function to import and create the face map
export function importSTEP(openCascade, fileContents) {
  try {
    // Determine the file type (assuming STEP)
    const fileType = "step";
    
    // Writes the uploaded file to Emscripten's Virtual Filesystem
    openCascade.FS.createDataFile("/", `file.${fileType}`, fileContents, true, true);
    
    // Create the appropriate reader
    const reader = new openCascade.STEPControl_Reader_1();
    
    // Read the file
    const readResult = reader.ReadFile(`file.${fileType}`);
    
    if (readResult === openCascade.IFSelect_ReturnStatus.IFSelect_RetDone) {
      console.log("File loaded successfully! Converting to OCC now...");
      
      // Transfer roots to OpenCascade model
      const numRootsTransferred = reader.TransferRoots(new openCascade.Message_ProgressRange_1());
      
      // Get the shape
      const shape = reader.OneShape();
      
      // Create a map of faces with unique IDs
      const faceMap = new Map();
      const ExpFace = new openCascade.TopExp_Explorer_1();
      let faceIndex = 0;
      
      for (ExpFace.Init(shape, openCascade.TopAbs_ShapeEnum.TopAbs_FACE, openCascade.TopAbs_ShapeEnum.TopAbs_SHAPE); ExpFace.More(); ExpFace.Next()) {
        faceIndex++;
        const face = ExpFace.Current();
        
        // Store the face with a unique index
        faceMap.set(faceIndex, {
          face: face,  // Store reference
        });
      }
      
      // Print the face map to the console after creation
      console.log("Face Map created during import:");
      console.log(`Total faces in the imported model: ${faceMap.size}`);
      
      ExpFace.delete();
      
      // Remove the file when we're done (otherwise we run into errors on reupload)
      openCascade.FS.unlink(`/file.${fileType}`);
      
      return {
        shape: shape,
        faceMap: faceMap
      };
    } else {
      console.error("Something in OCCT went wrong trying to read the file");
      return { shape: null, faceMap: new Map() };
    }
  } catch (error) {
    console.error("Error in importSTEP:", error);
    return { shape: null, faceMap: new Map() };
  }

  
  return {
    shape: shape,
    faceMap: faceMap
  };
}

// Modified visualization function that uses imported data with face mapping
export default function visualize(openCascade, importedData) {
  // Extract shape and faceMap from imported data
  const shape = importedData.shape;
  const faceMap = importedData.faceMap;
  
  let geometries = [];
  const ExpFace = new openCascade.TopExp_Explorer_1();
  let faceIndex = 0;
  
  for (ExpFace.Init(shape, openCascade.TopAbs_ShapeEnum.TopAbs_FACE, openCascade.TopAbs_ShapeEnum.TopAbs_SHAPE); ExpFace.More(); ExpFace.Next()) {
    faceIndex++;
    const myShape = ExpFace.Current();
    const myFace = openCascade.TopoDS.Face_1(myShape);
    
    let inc;
    try {
      // In case some of the faces cannot be visualized
      inc = new openCascade.BRepMesh_IncrementalMesh_2(myFace, 0.1, false, 0.5, false);
    } catch (e) {
      console.error('face visualizing failed');
      continue;
    }
    
    const aLocation = new openCascade.TopLoc_Location_1();
    const myT = openCascade.BRep_Tool.Triangulation(myFace, aLocation, 0 /* == Poly_MeshPurpose_NONE */);
    
    if (myT.IsNull()) {
      continue;
    }
    
    const pc = new openCascade.Poly_Connect_2(myT);
    const triangulation = myT.get();
    let vertices = new Float32Array(triangulation.NbNodes() * 3);
    
    // Write vertex buffer
    for (let i = 1; i <= triangulation.NbNodes(); i++) {
      const t1 = aLocation.Transformation();
      const p = triangulation.Node(i);
      const p1 = p.Transformed(t1);
      vertices[3 * (i - 1)] = p1.X();
      vertices[3 * (i - 1) + 1] = p1.Y();
      vertices[3 * (i - 1) + 2] = p1.Z();
      p.delete();
      t1.delete();
      p1.delete();
    }
    
    // Write normal buffer
    const myNormal = new openCascade.TColgp_Array1OfDir_2(1, triangulation.NbNodes());
    openCascade.StdPrs_ToolTriangulatedShape.Normal(myFace, pc, myNormal);
    let normals = new Float32Array(myNormal.Length() * 3);
    
    for (let i = myNormal.Lower(); i <= myNormal.Upper(); i++) {
      const t1 = aLocation.Transformation();
      const d1 = myNormal.Value(i);
      const d = d1.Transformed(t1);
      normals[3 * (i - 1)] = d.X();
      normals[3 * (i - 1) + 1] = d.Y();
      normals[3 * (i - 1) + 2] = d.Z();
      t1.delete();
      d1.delete();
      d.delete();
    }
    myNormal.delete();
    
    // Write triangle buffer
    const orient = myFace.Orientation_1();
    const triangles = myT.get().Triangles();
    let indices;
    let triLength = triangles.Length() * 3;
    
    if (triLength > 65535)
      indices = new Uint32Array(triLength);
    else
      indices = new Uint16Array(triLength);
    
    for (let nt = 1; nt <= myT.get().NbTriangles(); nt++) {
      const t = triangles.Value(nt);
      let n1 = t.Value(1);
      let n2 = t.Value(2);
      let n3 = t.Value(3);
      
      if (orient !== openCascade.TopAbs_Orientation.TopAbs_FORWARD) {
        let tmp = n1;
        n1 = n2;
        n2 = tmp;
      }
      
      indices[3 * (nt - 1)] = n1 - 1;
      indices[3 * (nt - 1) + 1] = n2 - 1;
      indices[3 * (nt - 1) + 2] = n3 - 1;
      t.delete();
    }
    triangles.delete();
    
    // Create geometry with reference to original face index
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    
    // Store metadata to link back to original face
    geometry.userData = {
      faceIndex: faceIndex
    };
    
    geometries.push(geometry);
    
    // Update our map with the geometry reference
    if (faceMap.has(faceIndex)) {
      faceMap.get(faceIndex).geometry = geometry;
    }
    
    pc.delete();
    aLocation.delete();
    myT.delete();
    inc.delete();
    myFace.delete();
    myShape.delete();
  }
  
  ExpFace.delete();
  
  // Print the face map to the console for debugging
  console.log("Face Map Contents:");
  console.log(`Total faces mapped: ${faceMap.size}`);
  
  // Log individual entries (limited to first 10 to avoid console clutter)
  const entriesArray = Array.from(faceMap.entries());
  console.log("First 10 face map entries:");
  for (let i = 0; i < Math.min(100, entriesArray.length); i++) {
    const [index, data] = entriesArray[i];
    console.log(`Face #${index}:`, {
      hasGeometry: data.geometry ? true : false,
      face: data.face ? "OpenCascade Face Object" : "Missing",
      // Add any other properties you want to see here
    });
  }
  
  // Return both the geometries and the mapping
  return {
    geometries: geometries,
    faceMap: faceMap
  };
}

// Helper function to demonstrate how to use the face map for selection
export function selectFace(faceIndex, result) {
  const faceMap = result.faceMap;
  
  if (faceMap.has(faceIndex)) {
    const faceData = faceMap.get(faceIndex);
    return {
      geometry: faceData.geometry,
      face: faceData.face
    };
  }
  
  return null;
}