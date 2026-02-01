import { themeManager } from './output'

export const logger = {
  info: (message: string) => {
    const colors = themeManager.getColors()
    const icons = themeManager.getIcons()
    console.log(colors.info(icons.info), message)
  },

  success: (message: string) => {
    const colors = themeManager.getColors()
    const icons = themeManager.getIcons()
    console.log(colors.success(icons.success), message)
  },

  warn: (message: string) => {
    const colors = themeManager.getColors()
    const icons = themeManager.getIcons()
    console.log(colors.warning(icons.warning), message)
  },

  error: (message: string) => {
    const colors = themeManager.getColors()
    const icons = themeManager.getIcons()
    console.log(colors.error(icons.error), message)
  },

  debug: (message: string) => {
    if (process.env.DEBUG) {
      const colors = themeManager.getColors()
      console.log(colors.muted('🐛'), message)
    }
  },
}
