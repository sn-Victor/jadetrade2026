"""
AI Chat System Prompts

Defines the system prompt and context building for JadeBot.
"""
from typing import List, Dict, Any

SYSTEM_PROMPT = """You are JadeBot, an AI trading assistant for the JadeTrade platform. You help users understand:

1. **Platform Features**: Subscription tiers (Free, Pro, Enterprise), trading bots, strategies, and how to use them.
2. **Trading Concepts**: Basic and advanced trading concepts, risk management, and best practices.
3. **Their Portfolio**: Analyzing their positions, P&L, and suggesting improvements.
4. **Technical Support**: Helping with API keys, webhook setup, and troubleshooting.

## Guidelines

- Be concise and helpful. Traders value efficiency.
- Always include relevant disclaimers for trading advice.
- If asked about specific trades, analyze objectively but never guarantee outcomes.
- For platform questions, refer to the knowledge base context provided.
- If you don't know something, say so. Don't make up information.
- Never reveal API keys, passwords, or sensitive user data.
- Use markdown formatting for better readability.

## Tone

Professional but approachable. You're a knowledgeable trading assistant, not a formal financial advisor.

## Disclaimers

When discussing trading strategies or market analysis, include:
"*This is for educational purposes only. Past performance doesn't guarantee future results. Always do your own research.*"

## Current User Context

The user's current context (positions, P&L, subscription tier) will be provided with each message. Use this to personalize responses.
"""


def build_context_prompt(
    user_context: Dict[str, Any],
    relevant_docs: List[Dict[str, str]],
) -> str:
    """
    Build context prompt with user data and relevant knowledge base docs.

    Args:
        user_context: User's trading context (positions, PnL, tier, etc.)
        relevant_docs: Documents retrieved from knowledge base via RAG

    Returns:
        Formatted context string to prepend to user message
    """
    sections = []

    # User context section
    if user_context:
        sections.append("## Your Current Status\n")

        if user_context.get("subscription_tier"):
            sections.append(f"- **Subscription**: {user_context['subscription_tier'].title()}")

        if user_context.get("portfolio_value") is not None:
            sections.append(f"- **Portfolio Value**: ${user_context['portfolio_value']:,.2f}")

        if user_context.get("total_pnl") is not None:
            pnl = user_context['total_pnl']
            pnl_str = f"+${pnl:,.2f}" if pnl >= 0 else f"-${abs(pnl):,.2f}"
            sections.append(f"- **Total P&L**: {pnl_str}")

        if user_context.get("open_positions"):
            sections.append(f"- **Open Positions**: {len(user_context['open_positions'])}")
            for pos in user_context['open_positions'][:3]:  # Show max 3
                side = "Long" if pos.get("side") == "long" else "Short"
                pnl = pos.get("unrealized_pnl", 0)
                pnl_str = f"+${pnl:.2f}" if pnl >= 0 else f"-${abs(pnl):.2f}"
                sections.append(f"  - {pos['symbol']}: {side} ({pnl_str})")

        if user_context.get("active_strategies"):
            sections.append(f"- **Active Strategies**: {len(user_context['active_strategies'])}")

        sections.append("")

    # Knowledge base section
    if relevant_docs:
        sections.append("## Relevant Information\n")
        for i, doc in enumerate(relevant_docs, 1):
            sections.append(f"### Source {i}: {doc.get('title', 'Documentation')}")
            sections.append(doc.get("content", "")[:500])  # Truncate long docs
            sections.append("")

    return "\n".join(sections)
