// Dev-only console logger. `import.meta.env.DEV` is replaced at build time
// by Vite so the prod branch tree-shakes to a no-op, ensuring sensitive
// data (user records, extraction results) never reaches production consoles.
export const debugLog = (...args) => {
  if (import.meta.env && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

export default debugLog
