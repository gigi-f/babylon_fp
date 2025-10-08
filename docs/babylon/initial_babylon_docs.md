# Babylon.js initial docs dump

Topics fetched: getting-started, api-reference, loaders

Sources: Babylon.js documentation repository and doc.babylonjs.com

## Getting started

Basic index.html (source: getting-set-up)
```html
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>Title of Your Project</title>
    </head>
    <body>
    </body>
</html>
```

Webpack configuration (development)
```javascript
const path = require("path");
const fs = require("fs");
const appDirectory = fs.realpathSync(process.cwd());

module.exports = {
    entry: path.resolve(appDirectory, "src/app.ts"), //path to the main .ts file
    output: {
        filename: "js/bundleName.js",
        clean: true
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
    },
    devServer: {
        host: "0.0.0.0",
        port: 8080,
        static: path.resolve(appDirectory, "public"),
        hot: true,
        devMiddleware: {
            publicPath: "/"
        }
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new (require("html-webpack-plugin"))({
            inject: true,
            template: path.resolve(appDirectory, "public/index.html")
        })
    ],
    mode: "development"
};
```

Recommended TypeScript imports for a minimal project
```typescript
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder } from "@babylonjs/core";
```

App initialization (example)
```typescript
class App {
    constructor() {
        var canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.id = "gameCanvas";
        document.body.appendChild(canvas);

        var engine = new Engine(canvas, true);
        var scene = new Scene(engine);

        var camera: ArcRotateCamera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);
        camera.attachControl(canvas, true);
        var light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1, 1, 0), scene);
        var sphere: Mesh = MeshBuilder.CreateSphere("sphere", { diameter: 1 }, scene);

        engine.runRenderLoop(() => {
            scene.render();
        });
    }
}
new App();
```

## Loaders

Dynamic registration (preferred for bundle size)
```typescript
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
registerBuiltInLoaders();
```

Side-effect imports (static)
```javascript
import "@babylonjs/loaders/OBJ/objFileLoader";
import "@babylonjs/loaders/glTF/2.0";
import "@babylonjs/loaders/STL/stlFileLoader";
```

CDN inclusion (quick testing)
```html
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
```

Loader options examples
```javascript
BABYLON.OBJFileLoader.COMPUTE_NORMALS = true;
BABYLON.SceneLoader.OnPluginActivatedObservable.addOnce(function (loader) {
  if (loader.name === "gltf") {
    loader.useRangeRequests = true;
  }
});
```

## API snippets (selected)

Path3D summary
```apdoc
BABYLON.Path3D:
  constructor(points: BABYLON.Vector3[])
  getPointAt(position: number): BABYLON.Vector3
```

Curve3
```apdoc
Curve3.getPoints(): Vector3[]
Curve3.length(): number
```

Audio
```javascript
BABYLON.CreateAudioEngineAsync(options?: IAudioEngineOptions)
BABYLON.CreateSoundAsync(name, source, scene)
```

EdgesRenderer
```apdoc
EdgesRenderer.enableEdgesRendering(epsilon: number = 0.95)
EdgesRenderer.disableEdgesRendering()
```

## Next steps
- Add remaining topics: materials, GUI, physics, particles, inspector, examples
- Normalize snippets into structured JSON for quick lookup
- Implement src/scripts/fetch_babylon_docs.ts to refresh docs automatically

Sources and credits
- Documentation content sourced from Babylon.js documentation repository and doc.babylonjs.com
- Context7 library id: /babylonjs/documentation