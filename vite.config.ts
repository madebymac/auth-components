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
  // Strip `debugger` statements in production builds (#7 HIGH-10).
  // Note: `console.*` calls are NOT dropped here because that would also
  // silence `console.error` / `console.warn`, which legitimately surface
  // failures to integrators. Instead, noisy `console.log` / `.info` /
  // `.debug` sites in src/ are gated with `import.meta.env.DEV` at the
  // source level — those become dead code in production builds.
  esbuild:
    mode === 'production'
      ? { drop: ['debugger'] }
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
