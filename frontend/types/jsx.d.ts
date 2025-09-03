declare namespace JSX {
  // Minimal JSX namespace to satisfy production TypeScript checks when @types/react
  // isn't available during build.
  interface Element {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
