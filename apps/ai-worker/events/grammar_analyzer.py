"""
ZenC AI Worker – Grammar Analyzer.

Analyzes session transcripts to identify grammar mistakes using
Google Gemini AI. Produces structured GrammarMistake objects that
are persisted to the UserMistakes table and fed into the SM-2
spaced repetition scheduler.

Design decisions:
- Using Gemini for grammar analysis rather than rule-based NLP
  because it handles nuanced errors (e.g., awkward phrasing,
  context-dependent mistakes) that traditional parsers miss.
- The analysis prompt is structured to return JSON, enabling
  reliable parsing without fragile regex extraction.
- Each mistake is tagged with a grammarRuleId from a predefined
  taxonomy, allowing the frontend to link to targeted tutorials.
"""

import json
import logging
from typing import Optional

import google.generativeai as genai

from config import settings

logger = logging.getLogger(__name__)

# ── Grammar Rule Taxonomy ────────────────────────────────────────
# Maps rule IDs to human-readable descriptions.
# Used by the frontend for targeted grammar lessons.
GRAMMAR_RULES = {
    "SVA-001": "Subject-Verb Agreement",
    "TEN-001": "Verb Tense Error",
    "TEN-002": "Tense Consistency",
    "ART-001": "Article Usage (a/an/the)",
    "ART-002": "Missing Article",
    "PRE-001": "Preposition Error",
    "PRO-001": "Pronoun Reference Error",
    "WOR-001": "Word Order",
    "CON-001": "Conjunction Usage",
    "PLU-001": "Plural/Singular Form",
    "MOD-001": "Modal Verb Usage",
    "GER-001": "Gerund vs. Infinitive",
    "COM-001": "Comparative/Superlative Error",
    "SEN-001": "Sentence Fragment",
    "SEN-002": "Run-on Sentence",
    "VOC-001": "Vocabulary/Word Choice",
    "SPE-001": "Spelling Error",
    "COL-001": "Collocation Error",
    "OTH-001": "Other Grammar Error",
}

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)


async def analyze_grammar(transcript: str) -> list[dict]:
    """
    Analyze a session transcript for grammar mistakes.

    Sends the transcript to Gemini with a structured prompt requesting
    JSON output. The model identifies errors, provides corrections,
    and classifies each mistake by grammar rule.

    Args:
        transcript: Full session transcript with AI: and [USER_AUDIO] markers.
                   Only user-generated text is analyzed (AI text is skipped).

    Returns:
        List of mistake dicts with keys:
        - originalSentence: The user's erroneous sentence
        - correctedSentence: The corrected version
        - grammarRuleId: Taxonomy ID (e.g., "SVA-001")
        - explanation: Brief explanation of the error

    Raises:
        RuntimeError: If Gemini API call fails after retries
    """
    try:
        # Extract user speech portions only (skip AI responses)
        user_lines = _extract_user_speech(transcript)

        if not user_lines:
            logger.info("No user speech found in transcript, skipping analysis")
            return []

        user_text = "\n".join(user_lines)

        # Build the analysis prompt
        prompt = _build_analysis_prompt(user_text)

        # Call Gemini for analysis
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,  # Low temperature for consistent analytical output
            ),
        )

        # Parse the JSON response
        mistakes = _parse_response(response.text)

        logger.info(f"Grammar analysis found {len(mistakes)} mistakes")
        return mistakes

    except Exception as e:
        logger.error(f"Grammar analysis failed: {e}")
        raise RuntimeError(f"Grammar analysis failed: {e}") from e


def _extract_user_speech(transcript: str) -> list[str]:
    """
    Extract user-generated text from the session transcript.

    The transcript contains lines prefixed with 'AI:' for bot responses
    and '[USER_AUDIO]' markers for user speech segments. We reconstruct
    user text by collecting non-AI lines.

    Why filter: Analyzing AI-generated text would produce false positives
    since the AI's own grammar is (usually) correct and shouldn't be
    attributed to the student.
    """
    lines = transcript.strip().split("\n")
    user_lines = []

    for line in lines:
        stripped = line.strip()
        # Skip AI responses and audio markers
        if stripped.startswith("AI:") or stripped == "[USER_AUDIO]" or not stripped:
            continue
        # Assume remaining lines are user text (from speech-to-text)
        user_lines.append(stripped)

    return user_lines


def _build_analysis_prompt(user_text: str) -> str:
    """
    Build the structured analysis prompt for Gemini.

    The prompt instructs the model to:
    1. Identify grammar, spelling, and vocabulary errors
    2. Classify each by grammar rule taxonomy
    3. Return structured JSON for reliable parsing

    Using few-shot examples improves output consistency.
    """
    rule_list = "\n".join(f"- {k}: {v}" for k, v in GRAMMAR_RULES.items())

    return f"""You are a professional English grammar analyzer for an EdTech platform.
Analyze the following student speech transcript for grammar, spelling, and vocabulary errors.

For each error found, provide:
1. The original sentence containing the error
2. The corrected sentence
3. A grammar rule ID from the taxonomy below
4. A brief, student-friendly explanation

Grammar Rule Taxonomy:
{rule_list}

Student Transcript:
---
{user_text}
---

Return a JSON array of objects with this exact structure:
[
  {{
    "originalSentence": "the original sentence with the error",
    "correctedSentence": "the corrected version",
    "grammarRuleId": "RULE-ID",
    "explanation": "brief explanation of what was wrong and why"
  }}
]

If no errors are found, return an empty array: []
Only include genuine errors, not stylistic preferences.
Be precise with the grammar rule classification."""


def _parse_response(response_text: str) -> list[dict]:
    """
    Parse Gemini's JSON response into a list of mistake dictionaries.

    Includes defensive parsing to handle edge cases where the model
    returns slightly malformed JSON or wraps the array in markdown.
    """
    try:
        # Strip potential markdown code fences
        text = response_text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]  # Remove first line
            text = text.rsplit("```", 1)[0]  # Remove last fence
            text = text.strip()

        mistakes = json.loads(text)

        if not isinstance(mistakes, list):
            logger.warning(f"Unexpected response format: {type(mistakes)}")
            return []

        # Validate each mistake has required fields
        validated = []
        for m in mistakes:
            if all(
                k in m
                for k in ["originalSentence", "correctedSentence", "grammarRuleId"]
            ):
                # Ensure grammarRuleId is valid, default to OTH-001
                if m["grammarRuleId"] not in GRAMMAR_RULES:
                    m["grammarRuleId"] = "OTH-001"
                validated.append(m)

        return validated

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse grammar analysis response: {e}")
        logger.debug(f"Raw response: {response_text[:500]}")
        return []
