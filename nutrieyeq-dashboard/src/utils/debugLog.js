export const debugLog = (...args) => {
  if (import.meta.env && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

export default debugLog
