import { Scene, AssetsManager, AbstractMesh, Texture, StandardMaterial, Color3 } from "@babylonjs/core";
import "@babylonjs/loaders";
import { DEFAULT_LOW_POLY_COLOR } from "./sharedConstants";
 
// Simple asset pipeline for loading models/textures and creating low‑poly‑friendly materials
 
type Model = AbstractMesh;

const modelCache = new Map<string, AbstractMesh[]>();
const textureCache = new Map<string, Texture>();

export async function loadModel(scene: Scene, rootUrl: string, sceneFilename: string): Promise<AbstractMesh[]> {
  const cacheKey = `${rootUrl}${sceneFilename}`;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey)!;

  return new Promise((resolve, reject) => {
    const assetsManager = new AssetsManager(scene);
    const meshTask = assetsManager.addMeshTask("loadModel", "", rootUrl, sceneFilename);
    meshTask.onSuccess = (task) => {
      const meshes = task.loadedMeshes as AbstractMesh[];
      modelCache.set(cacheKey, meshes);
      resolve(meshes);
    };
    meshTask.onError = (task, message, exception) => {
      reject(new Error(`Failed to load model ${rootUrl}${sceneFilename}: ${message}`));
    };
    assetsManager.load();
  });
}

export async function loadTexture(scene: Scene, url: string): Promise<Texture> {
  if (textureCache.has(url)) return textureCache.get(url)!;
  return new Promise((resolve, reject) => {
    const tex = new Texture(
      url,
      scene,
      false,
      true,
      undefined,
      () => {
        textureCache.set(url, tex);
        resolve(tex);
      },
      (message, exception) => {
        reject(new Error(`Failed to load texture ${url}: ${message}`));
      }
    );
  });
}

export function createLowPolyMaterial(scene: Scene, baseColor: Color3 = DEFAULT_LOW_POLY_COLOR) {
  const mat = new StandardMaterial(`lp_mat_${Math.floor(Math.random() * 10000)}`, scene);
  mat.diffuseColor = baseColor;
  mat.specularColor = Color3.Black();
  mat.emissiveColor = Color3.Black();
  // reduce visible shininess where possible
  (mat as any).specularPower = 0;
  // prefer vertex colors for a flat aesthetic when available
  (mat as any).useVertexColor = true;
  mat.backFaceCulling = true;
  return mat;
}

export function applyLowPolyMaterial(meshes: AbstractMesh[] | AbstractMesh, scene: Scene, color?: Color3) {
  const mArr = Array.isArray(meshes) ? meshes : [meshes];
  const mat = createLowPolyMaterial(scene, color ?? DEFAULT_LOW_POLY_COLOR);
  for (const m of mArr) {
    try {
      // If the loaded object is a container, apply to children
      if ((m as any).getChildMeshes) {
        const children = (m as any).getChildMeshes();
        children.forEach((c: AbstractMesh) => (c.material = mat));
      } else {
        (m as AbstractMesh).material = mat as any;
      }
    } catch {
      // ignore problematic mesh assignments
    }
  }
  return mat;
}

export function clearCaches() {
  modelCache.clear();
  textureCache.clear();
}

export default {
  loadModel,
  loadTexture,
  createLowPolyMaterial,
  applyLowPolyMaterial,
  clearCaches,
};