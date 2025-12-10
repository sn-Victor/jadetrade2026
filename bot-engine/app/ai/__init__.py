"""
AI Chatbot Module

Provides AI-powered chat functionality using Claude API with RAG.
"""
from app.ai.chat_engine import ChatEngine, get_chat_engine
from app.ai.prompts import SYSTEM_PROMPT, build_context_prompt

__all__ = [
    "ChatEngine",
    "get_chat_engine",
    "SYSTEM_PROMPT",
    "build_context_prompt",
]
