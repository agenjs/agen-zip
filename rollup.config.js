import {nodeResolve} from "@rollup/plugin-node-resolve";
import {terser} from "rollup-plugin-terser";
import generatePackageJson from 'rollup-plugin-generate-package-json'
import * as meta from "./package.json";

const distName = meta.name.replace('@', '').replace('/', '-');
const config = {
  input: "src/index.js",
  external: Object.keys(meta.dependencies || {}).filter(key => /^@agen/.test(key)),
  output: {
    name: "agen",
    indent: false,
    extend: true,
    banner: `// ${meta.homepage} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author.name}`,
    globals: Object.assign({}, ...Object.keys(meta.dependencies || {}).filter(key => /^@agen/.test(key)).map(key => ({[key]: "agen"})))
  },
  plugins: [
    nodeResolve(),
    generatePackageJson({
      outputFolder: 'dist/cjs',
      baseContents: {
        "type": "commonjs"
      }
    })
  ]
};

export default [
  // CJS modules
  {
    ...config,
    output: {
      ...config.output,
      format: "umd",
      file: `dist/cjs/${distName}.js`
    },
  },
  {
    ...config,
    output: {
      ...config.output,
      format: "umd",
      file: `dist/cjs/${distName}.min.js`
    },
    plugins: [
      ...config.plugins,
      terser({
        output: {
          preamble: config.output.banner
        }
      })
    ]
  },
  // ESM modules
  {
    ...config,
    output: {
      ...config.output,
      format: "es",
      file: `dist/esm/${distName}-esm.js`,
      banner: config.output.banner + `\nvar module = {};\n\n`
    },
  },
  {
    ...config,
    output: {
      ...config.output,
      format: "es",
      file: `dist/esm/${distName}-esm.min.js`,
      banner: config.output.banner + `\nvar module = {};\n\n`
    },
    plugins: [
      ...config.plugins,
      terser({
        output: {
          preamble: config.output.banner
        }
      })
    ]    
  }
];
