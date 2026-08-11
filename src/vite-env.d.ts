/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.yml' {
  const value: unknown
  export default value
}

declare module '*.yaml' {
  const value: unknown
  export default value
}
