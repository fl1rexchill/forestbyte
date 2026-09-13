/** FSM-состояния диалога рассылки (строки как у aiogram StatesGroup). */
export const BroadcastStates = {
  /** ждём текст рассылки */
  waitingText: "BroadcastStates:waiting_text",
  /** показали превью, ждём подтверждения */
  waitingConfirm: "BroadcastStates:waiting_confirm",
} as const;
