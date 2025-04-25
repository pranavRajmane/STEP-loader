// Import necessary Three.js classes for 3D geometry representation
import {
  Face3,
  Vector3
} from 'three';

/**
 * Helper object for working with OpenCascade.js - a JavaScript port of the OpenCascade
 * CAD kernel, which is used for 3D solid modeling operations.
 * This helper provides utility functions to convert OpenCascade geometry to Three.js geometry.
 */
const openCascadeHelper = {
  /**
   * Sets the OpenCascade instance to be used by this helper
   * @param {Object} openCascade - The OpenCascade.js instance
   */
  setOpenCascade(openCascade) {
    this.openCascade = openCascade;
  },

  /**
   * Tessellates (converts to triangles) an OpenCascade shape
   * This is necessary because OpenCascade uses parametric surfaces and curves,
   * but for rendering we need triangulated meshes
   * 
   * @param {Object} shape - The OpenCascade shape to tessellate
   * @returns {Array} List of faces, each containing vertex coordinates, normal coordinates, and triangle indices
   */
  tessellate(shape) {
    const facelist = [];
    
    // Create a mesh of the shape with specified parameters:
    // - 0.1: linear deflection (controls tessellation precision)
    // - false: not relative deflection
    // - 0.5: angular deflection (controls tessellation precision for curved surfaces)
    // - false: not interior only
    new this.openCascade.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false);
    
    // Create an explorer to iterate through all faces in the shape
    const ExpFace = new this.openCascade.TopExp_Explorer_1();
    
    // Initialize explorer to find faces in the shape
    for (ExpFace.Init(shape, this.openCascade.TopAbs_ShapeEnum.TopAbs_FACE, this.openCascade.TopAbs_ShapeEnum.TopAbs_SHAPE); 
         ExpFace.More(); 
         ExpFace.Next()) {
      
      // Get the current face from the explorer
      const myFace = this.openCascade.TopoDS.Face_1(ExpFace.Current());
      
      // Get the location/transformation of the face
      const aLocation = new this.openCascade.TopLoc_Location_1();
      
      // Get the triangulation of the face (the mesh representation)
      const myT = this.openCascade.BRep_Tool.Triangulation(myFace, aLocation, 0 /* == Poly_MeshPurpose_NONE */);
      
      // Skip faces without triangulation
      if (myT.IsNull()) {
        continue;
      }

      // Create an object to store this face's data
      const this_face = {
        vertex_coord: [],    // Will store the coordinates of each vertex
        normal_coord: [],    // Will store the normal vectors at each vertex
        tri_indexes: [],     // Will store the vertex indices for each triangle
        number_of_triangles: 0,  // Will count the number of triangles
      };

      // Create a connection tool for navigating the triangulation
      const pc = new this.openCascade.Poly_Connect_2(myT);
      const triangulation = myT.get();

      // Extract vertex coordinates
      this_face.vertex_coord = new Array(triangulation.NbNodes() * 3); // x,y,z for each vertex
      for (let i = 1; i <= triangulation.NbNodes(); i++) {
        // Get the vertex and transform it according to the face's location
        const p = triangulation.Node(i).Transformed(aLocation.Transformation());
        // Store the x, y, z coordinates
        this_face.vertex_coord[((i - 1) * 3) + 0] = p.X();
        this_face.vertex_coord[((i - 1) * 3) + 1] = p.Y();
        this_face.vertex_coord[((i - 1) * 3) + 2] = p.Z();
      }

      // Extract normal vectors
      // Create an array to store the normal vectors
      const myNormal = new this.openCascade.TColgp_Array1OfDir_2(1, triangulation.NbNodes());
      // Calculate the normals for the face
      this.openCascade.StdPrs_ToolTriangulatedShape.Normal(myFace, pc, myNormal);
      this_face.normal_coord = new Array(myNormal.Length() * 3); // x,y,z for each normal
      for (let i = myNormal.Lower(); i <= myNormal.Upper(); i++) {
        // Get the normal vector and transform it according to the face's location
        const d = myNormal.Value(i).Transformed(aLocation.Transformation());
        // Store the x, y, z components
        this_face.normal_coord[((i - 1) * 3) + 0] = d.X();
        this_face.normal_coord[((i - 1) * 3) + 1] = d.Y();
        this_face.normal_coord[((i - 1) * 3) + 2] = d.Z();
      }

      // Extract triangle indices
      // Get the face orientation (forward or reversed)
      const orient = myFace.Orientation_1();
      // Get the triangles from the triangulation
      const triangles = myT.get().Triangles();
      this_face.tri_indexes = new Array(triangles.Length() * 3); // 3 vertices per triangle
      let validFaceTriCount = 0;
      
      // Process each triangle
      for (let nt = 1; nt <= myT.get().NbTriangles(); nt++) {
        const t = triangles.Value(nt);
        // Get the three vertex indices for this triangle
        let n1 = t.Value(1);
        let n2 = t.Value(2);
        let n3 = t.Value(3);
        
        // If the face is not oriented forward, swap two vertices to correct the winding order
        // This ensures consistent normal direction
        if (orient !== this.openCascade.TopAbs_Orientation.TopAbs_FORWARD) {
          let tmp = n1;
          n1 = n2;
          n2 = tmp;
        }
        
        // Store the vertex indices for this triangle
        this_face.tri_indexes[(validFaceTriCount * 3) + 0] = n1;
        this_face.tri_indexes[(validFaceTriCount * 3) + 1] = n2;
        this_face.tri_indexes[(validFaceTriCount * 3) + 2] = n3;
        validFaceTriCount++;
      }
      
      // Store the total number of triangles
      this_face.number_of_triangles = validFaceTriCount;
      // Add this face to the list
      facelist.push(this_face);
    }
    return facelist;
  },

  /**
   * Joins multiple face data structures into a single mesh
   * This combines all the separate faces into one continuous geometry
   * 
   * @param {Array} facelist - List of faces from tessellate()
   * @returns {Array} Combined arrays of [vertices, normals, triangle indices]
   */
  joinPrimitives(facelist) {
    let obP = 0;  // Counter for vertices
    let obN = 0;  // Counter for normals
    let obTR = 0; // Counter for triangles
    let advance = 0; // Offset for vertex indices when combining faces
    
    // Arrays to store the combined data
    const locVertexcoord = [];
    const locNormalcoord = [];
    const locTriIndices = [];

    // Process each face
    facelist.forEach(myface => {
      // Copy all vertex coordinates
      for (let x = 0; x < myface.vertex_coord.length / 3; x++) {
        locVertexcoord[(obP * 3) + 0] = myface.vertex_coord[(x * 3) + 0];
        locVertexcoord[(obP * 3) + 1] = myface.vertex_coord[(x * 3) + 1];
        locVertexcoord[(obP * 3) + 2] = myface.vertex_coord[(x * 3) + 2];
        obP++;
      }
      
      // Copy all normal coordinates
      for (let x = 0; x < myface.normal_coord.length / 3; x++) {
        locNormalcoord[(obN * 3) + 0] = myface.normal_coord[(x * 3) + 0];
        locNormalcoord[(obN * 3) + 1] = myface.normal_coord[(x * 3) + 1];
        locNormalcoord[(obN * 3) + 2] = myface.normal_coord[(x * 3) + 2];
        obN++;
      }
      
      // Copy triangle indices, adjusting for the offset (advance)
      // This ensures the indices point to the correct vertices after combining
      for (let x = 0; x < myface.tri_indexes.length / 3; x++) {
        locTriIndices[(obTR * 3) + 0] = myface.tri_indexes[(x * 3) + 0] + advance - 1;
        locTriIndices[(obTR * 3) + 1] = myface.tri_indexes[(x * 3) + 1] + advance - 1;
        locTriIndices[(obTR * 3) + 2] = myface.tri_indexes[(x * 3) + 2] + advance - 1;
        obTR++;
      }

      // Update the advance offset for the next face
      advance = obP;
    });
    
    return [locVertexcoord, locNormalcoord, locTriIndices];
  },

  /**
   * Helper function to extract triangle information
   * Gets vertex, normal, and texture indices for a specific triangle
   * 
   * @param {Number} trianglenum - Index of the triangle
   * @param {Array} locTriIndices - Array of triangle indices
   * @returns {Array} Arrays of [vertex indices, normal indices, texture indices]
   */
  objGetTriangle(trianglenum, locTriIndices) {
    // Get the vertex indices for this triangle
    // Each index is multiplied by 3 because each vertex has 3 coordinates (x,y,z)
    const pID = locTriIndices[(trianglenum * 3) + 0] * 3;
    const qID = locTriIndices[(trianglenum * 3) + 1] * 3;
    const rID = locTriIndices[(trianglenum * 3) + 2] * 3;

    // Return the indices for vertices, normals, and texture coordinates
    // (in this implementation, they use the same indices)
    const vertices = [pID, qID, rID];
    const normals = [pID, qID, rID];
    const texcoords = [pID, qID, rID];
    return [vertices, normals, texcoords];
  },

  /**
   * Generates Three.js geometry from the processed mesh data
   * Converts the arrays of coordinates and indices into Three.js Vector3 and Face3 objects
   * 
   * @param {Number} tot_triangle_count - Total number of triangles
   * @param {Array} locVertexcoord - Array of vertex coordinates
   * @param {Array} locNormalcoord - Array of normal coordinates
   * @param {Array} locTriIndices - Array of triangle indices
   * @returns {Array} Arrays of [vertices, faces] for Three.js
   */
  generateGeometry(tot_triangle_count, locVertexcoord, locNormalcoord, locTriIndices) {
    const vertices = [];
    const faces = [];
    
    // Helper function to create a vertex
    function v(x, y, z) {
      vertices.push(new Vector3(x, y, z));
    }
    
    // Helper function to create a face with 3 vertices and their normals
    function f3(a, b, c, n1_x, n1_y, n1_z, n2_x, n2_y, n2_z, n3_x, n3_y, n3_z) {
      faces.push(new Face3(a, b, c, [
        new Vector3(n1_x, n1_y, n1_z),
        new Vector3(n2_x, n2_y, n2_z),
        new Vector3(n3_x, n3_y, n3_z)
      ]));
    }
    
    // Create vertices for each triangle
    // Note: This creates new vertices for each triangle, even if they are shared
    // This is necessary because Three.js requires unique vertices for face normals
    for (let i = 0; i < tot_triangle_count; i++) {
      const [vertices_idx, /*normals_idx*/, /*texcoords_idx*/] = this.objGetTriangle(i, locTriIndices);
      
      // Create first vertex
      v(
        locVertexcoord[vertices_idx[0] + 0],
        locVertexcoord[vertices_idx[0] + 1],
        locVertexcoord[vertices_idx[0] + 2]
      );
      
      // Create second vertex
      v(
        locVertexcoord[vertices_idx[1] + 0],
        locVertexcoord[vertices_idx[1] + 1],
        locVertexcoord[vertices_idx[1] + 2]
      );
      
      // Create third vertex
      v(
        locVertexcoord[vertices_idx[2] + 0],
        locVertexcoord[vertices_idx[2] + 1],
        locVertexcoord[vertices_idx[2] + 2]
      );
    }
    
    // Create faces with normals for each triangle
    for (let i = 0; i < tot_triangle_count; i++) {
      const [/*vertices_idx*/, normals_idx, /*texcoords_idx*/] = this.objGetTriangle(i, locTriIndices);
      
      // Create face with vertex indices (3 per triangle) and normal vectors
      f3(
        0 + i * 3,            // First vertex index
        1 + i * 3,            // Second vertex index
        2 + i * 3,            // Third vertex index
        locNormalcoord[normals_idx[0] + 0],  // First vertex normal x
        locNormalcoord[normals_idx[0] + 1],  // First vertex normal y
        locNormalcoord[normals_idx[0] + 2],  // First vertex normal z
        locNormalcoord[normals_idx[1] + 0],  // Second vertex normal x
        locNormalcoord[normals_idx[1] + 1],  // Second vertex normal y
        locNormalcoord[normals_idx[1] + 2],  // Second vertex normal z
        locNormalcoord[normals_idx[2] + 0],  // Third vertex normal x
        locNormalcoord[normals_idx[2] + 1],  // Third vertex normal y
        locNormalcoord[normals_idx[2] + 2]   // Third vertex normal z
      );
    }
    
    return [vertices, faces];
  }
};

export default openCascadeHelper;