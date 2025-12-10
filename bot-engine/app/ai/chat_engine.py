"""
AI Chat Engine

Core chat functionality using Claude API with streaming support.
"""
from typing import AsyncGenerator, Optional, List, Dict, Any
import os

from app.logging.logger import get_logger
from app.ai.prompts import SYSTEM_PROMPT, build_context_prompt

logger = get_logger("chat")


class ChatEngine:
    """
    AI Chat engine using Claude API with RAG.

    Provides both streaming and non-streaming chat responses,
    with context from user data and knowledge base.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 2048,
    ):
        """
        Initialize the chat engine.

        Args:
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
            model: Claude model to use
            max_tokens: Maximum tokens in response
        """
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = model
        self.max_tokens = max_tokens
        self._client = None

    @property
    def client(self):
        """Lazy initialization of Anthropic client"""
        if self._client is None:
            try:
                from anthropic import AsyncAnthropic
                self._client = AsyncAnthropic(api_key=self.api_key)
            except ImportError:
                logger.error("anthropic package not installed. Install with: pip install anthropic")
                raise ImportError("anthropic package required for chat functionality")
        return self._client

    async def chat(
        self,
        user_id: str,
        message: str,
        conversation_history: List[Dict[str, str]],
        user_context: Dict[str, Any],
        relevant_docs: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream a chat response with RAG context.

        Args:
            user_id: User ID for context
            message: User's message
            conversation_history: Previous messages in conversation
            user_context: User's trading context (positions, PnL, tier, etc.)
            relevant_docs: Documents from knowledge base (optional, will search if None)

        Yields:
            Chunks of the response text
        """
        logger.info(
            "Processing chat message",
            extra_data={
                "user_id": user_id,
                "message_length": len(message),
                "history_length": len(conversation_history),
            }
        )

        try:
            # Get relevant docs if not provided
            if relevant_docs is None:
                from app.ai.embeddings import search_knowledge_base
                relevant_docs = await search_knowledge_base(message, limit=5)

            # Build context prompt
            context_prompt = build_context_prompt(
                user_context=user_context,
                relevant_docs=relevant_docs or [],
            )

            # Build messages
            messages = []

            # Add conversation history (last 10 messages)
            for msg in conversation_history[-10:]:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

            # Add current message with context
            if context_prompt:
                messages.append({
                    "role": "user",
                    "content": f"{context_prompt}\n\nUser question: {message}",
                })
            else:
                messages.append({
                    "role": "user",
                    "content": message,
                })

            # Stream response from Claude
            input_tokens = 0
            output_tokens = 0

            async with self.client.messages.stream(
                model=self.model,
                max_tokens=self.max_tokens,
                system=SYSTEM_PROMPT,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield text

                # Get final message for token counts
                final_message = await stream.get_final_message()
                input_tokens = final_message.usage.input_tokens
                output_tokens = final_message.usage.output_tokens

            logger.info(
                "Chat response completed",
                extra_data={
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "docs_used": len(relevant_docs) if relevant_docs else 0,
                }
            )

        except ImportError as e:
            logger.error(f"Import error: {e}")
            yield "I'm sorry, the chat service is not properly configured. Please contact support."
        except Exception as e:
            error_type = type(e).__name__
            logger.error(f"Chat error ({error_type}): {e}", exc_info=True)

            # Check for specific error types
            if "AuthenticationError" in error_type:
                yield "I'm sorry, there's an authentication issue with the AI service. Please contact support."
            elif "RateLimitError" in error_type:
                yield "I'm experiencing high demand right now. Please try again in a moment."
            else:
                yield "I'm sorry, I encountered an error processing your request. Please try again."

    async def get_response(
        self,
        user_id: str,
        message: str,
        conversation_history: List[Dict[str, str]],
        user_context: Dict[str, Any],
        relevant_docs: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Get complete response (non-streaming).

        Args:
            user_id: User ID for context
            message: User's message
            conversation_history: Previous messages
            user_context: User's trading context
            relevant_docs: Documents from knowledge base

        Returns:
            Complete response text
        """
        chunks = []
        async for chunk in self.chat(
            user_id, message, conversation_history, user_context, relevant_docs
        ):
            chunks.append(chunk)
        return "".join(chunks)


# Singleton instance
_chat_engine: Optional[ChatEngine] = None


def get_chat_engine() -> ChatEngine:
    """Get or create the singleton ChatEngine instance"""
    global _chat_engine
    if _chat_engine is None:
        _chat_engine = ChatEngine()
    return _chat_engine


def set_chat_engine(engine: ChatEngine) -> None:
    """Set the ChatEngine instance (useful for testing)"""
    global _chat_engine
    _chat_engine = engine
