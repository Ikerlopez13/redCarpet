import * as esbuild from 'esbuild';
import fs from 'fs';
import { execSync } from 'child_process';

if (!fs.existsSync('dist')) fs.mkdirSync('dist');
if (!fs.existsSync('dist/assets')) fs.mkdirSync('dist/assets');

console.log("Using Tailwind CDN instead of local CLI...");

const envLocal = fs.readFileSync('.env.local', 'utf8');
const envVars = {
  'process.env.NODE_ENV': '"production"',
  'import.meta.env.DEV': 'false',
  'import.meta.env.PROD': 'true',
  'import.meta.env.MODE': '"production"'
};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim();
    if (key.startsWith('VITE_')) {
      envVars[`import.meta.env.${key}`] = JSON.stringify(val);
    }
  }
});

console.log("Bundling JS with ESBuild...");
esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outfile: 'dist/assets/index.js',
  minify: true,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl' },
  define: envVars,
}).then(() => {
  if (fs.existsSync('public')) {
    execSync('cp -a public/* dist/');
  }
  fs.copyFileSync('index.html', 'dist/index.html');
  let html = fs.readFileSync('dist/index.html', 'utf8');
  html = html.replace('type="module" src="/src/main.tsx"', 'type="module" src="/assets/index.js"');
  const tailwindConfig = `
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              "primary": "#FF3131",
              "background-light": "#f6f8f6",
              "background-dark": "#0d0d0d",
              "card-dark": "#1a1212",
              "safety-orange": "#ff9800",
              "safety-red": "#f44336",
            },
            fontFamily: {
              "sans": ["Arial", "Helvetica", "sans-serif"],
              "display": ["Arial", "Helvetica", "sans-serif"]
            },
            borderRadius: {
              "lg": "0.5rem",
              "xl": "0.625rem",
              "2xl": "0.875rem",
              "3xl": "1rem",
            }
          }
        }
      }
    </script>
  `;
  
  const indexCss = fs.readFileSync('src/index.css', 'utf8');
  
  html = html.replace('</head>', '<script src="https://cdn.tailwindcss.com"></script>' + tailwindConfig + '<style type="text/tailwindcss">' + indexCss + '</style></head>');
  fs.writeFileSync('dist/index.html', html);
  console.log("✅ Custom ESBuild Complete in 2 seconds!");
}).catch(() => process.exit(1));
