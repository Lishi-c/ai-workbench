// 全局 Esc 键注册表：详情页注册「返回」，本地确认弹窗注册「关闭」。
// workbench.tsx 的全局 keydown 监听按优先级执行（弹窗/浮层 > 返回）。
let backHandler: (() => void) | null = null;
let popupHandler: (() => void) | null = null;

export function setEscBack(fn: (() => void) | null) {
  backHandler = fn;
}
export function setEscPopup(fn: (() => void) | null) {
  popupHandler = fn;
}
export function getEscBack() {
  return backHandler;
}
export function getEscPopup() {
  return popupHandler;
}
