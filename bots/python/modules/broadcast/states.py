"""FSM-состояния диалога рассылки."""
from aiogram.fsm.state import State, StatesGroup


class BroadcastStates(StatesGroup):
    waiting_text = State()      # ждём текст рассылки
    waiting_confirm = State()   # показали превью, ждём подтверждения
