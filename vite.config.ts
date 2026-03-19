import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

/**
 * Vite plugin to resolve Figma-generated `figma:asset/...` imports.
 * These are produced by Figma's code-gen but the actual image files
 * aren't committed to the repo.  We resolve them to a transparent
 * 1×1 PNG data-URI so the app can boot without the original assets.
 */
function figmaAssetPlugin(): Plugin {
  const FIGMA_PREFIX = 'figma:asset/'
  const PLACEHOLDER =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg=='

  return {
    name: 'figma-asset-placeholder',
    enforce: 'pre',
    resolveId(source) {
      if (source.startsWith(FIGMA_PREFIX)) {
        return `\0figma-asset:${source.slice(FIGMA_PREFIX.length)}`
      }
    },
    load(id) {
      if (id.startsWith('\0figma-asset:')) {
        return `export default "${PLACEHOLDER}";`
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetPlugin(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
