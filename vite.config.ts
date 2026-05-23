import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
      include: ['src/**/*'],
      exclude: [
        'vite.config.ts',
        'tsconfig*.json',
        '**/*.config.*',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/test/**',
        'node_modules/**/*'
      ]
    })
  ],
  // Strip `console.*` and `debugger` in production builds (#7 HIGH-10).
  // src/lib/auth.ts has 40+ console.log calls that would otherwise leak
  // user objects and call stacks through the published bundle. Works
  // independently of `build.minify` because `drop` is an esbuild
  // transform, not a minify pass. Dev builds keep them for debugging.
  esbuild:
    mode === 'production'
      ? { drop: ['console', 'debugger'] }
      : {},
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.ts'),
        login: path.resolve(__dirname, 'src/components/LoginForm.tsx'),
        register: path.resolve(__dirname, 'src/components/RegistrationForm.tsx'),
        auth: path.resolve(__dirname, 'src/lib/auth.ts'),
      },
      name: 'AuthComponents',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`
    },
    rollupOptions: {
      external: [
        'react', 
        'react-dom', 
        'react/jsx-runtime',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-label', 
        '@radix-ui/react-slot',
        'class-variance-authority',
        'clsx',
        'lucide-react',
        'tailwind-merge'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          '@radix-ui/react-checkbox': 'RadixCheckbox',
          '@radix-ui/react-label': 'RadixLabel',
          '@radix-ui/react-slot': 'RadixSlot',
          'class-variance-authority': 'classVarianceAuthority',
          'clsx': 'clsx',
          'lucide-react': 'lucideReact',
          'tailwind-merge': 'tailwindMerge'
        }
      }
    },
    // Source maps are not shipped (#7 LOW-2). Published .js.map files
    // embed the full TypeScript source, which adds disclosure on top
    // of debuggability for consumers — and consumers can already read
    // src/ directly from the repo if they need it.
    sourcemap: false,
    minify: false
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
