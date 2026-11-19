export function autoPanelHeight(options: { textHeight: number; controlsHeight: number; inputHeight: number; frameHeight: number; workAreaHeight: number; minimumHeight: number }): number {
  return Math.min(Math.max(options.minimumHeight, Math.ceil(options.textHeight + options.inputHeight + options.controlsHeight + options.frameHeight)), Math.min(360, options.workAreaHeight - 24));
}
