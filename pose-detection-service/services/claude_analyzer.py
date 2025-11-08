"""
Claude 3.5 Sonnet analyzer via OpenRouter API
Analyzes baseball swing frames and generates recommendations
"""
import os
import requests
import logging
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Dict, Optional

# Load environment variables from root .env.local file
root_dir = Path(__file__).parent.parent.parent
env_local = root_dir / '.env.local'
if env_local.exists():
    load_dotenv(env_local)
else:
    load_dotenv()

logger = logging.getLogger(__name__)

class ClaudeAnalyzer:
    """Analyzes baseball swing frames using Claude 3.5 Sonnet via OpenRouter"""
    
    def __init__(self):
        """Initialize Claude analyzer with OpenRouter configuration"""
        self.api_key = os.getenv('OPENROUTER_API_KEY')
        self.model = os.getenv('OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet')
        self.base_url = os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
        
        if not self.api_key:
            logger.error("OPENROUTER_API_KEY not set - Claude analysis will fail")
            logger.error(f"Environment variables loaded from: {root_dir / '.env.local'}")
        else:
            logger.info(f"OpenRouter API key found (length: {len(self.api_key)})")
        
        self.endpoint = f"{self.base_url}/chat/completions"
        logger.info(f"Claude analyzer initialized with model: {self.model}, endpoint: {self.endpoint}")
    
    def analyze_frame(self, frame_base64: str, frame_index: int) -> Optional[Dict]:
        """
        Analyze a single frame using Claude 3.5 Sonnet
        
        Args:
            frame_base64: Base64 encoded image (JPEG)
            frame_index: Frame index in the video
            
        Returns:
            Dictionary with analysis result or None if error
        """
        if not self.api_key:
            logger.error("OpenRouter API key not configured - check OPENROUTER_API_KEY environment variable")
            return None
        
        logger.info(f"Calling OpenRouter API for frame {frame_index} (model: {self.model}, endpoint: {self.endpoint})")
        
        try:
            prompt = f"""Analyze this baseball swing frame (frame {frame_index}). 
Focus on:
1. Body position and posture
2. Hip rotation and weight transfer
3. Shoulder alignment and rotation
4. Bat position and angle
5. Overall swing mechanics

Provide a brief analysis (2-3 sentences) of what you observe in this frame."""
            
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{frame_base64}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 300
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": os.getenv('OPENROUTER_REFERER', 'https://baseballtrainer.app'),
                "X-Title": "Baseball Trainer"
            }
            
            logger.debug(f"Sending request to OpenRouter: {self.endpoint} with model {self.model}")
            
            response = requests.post(
                self.endpoint,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            logger.info(f"OpenRouter API response status: {response.status_code}")
            
            if response.status_code == 429:
                logger.warning("Rate limit exceeded for OpenRouter API")
                return None
            
            # Log response details before raising for status
            if not response.ok:
                logger.error(f"OpenRouter API error response: {response.status_code} - {response.text[:500]}")
            
            response.raise_for_status()
            
            result = response.json()
            logger.debug(f"OpenRouter API response structure: {list(result.keys())}")
            
            # Extract the analysis text
            if 'choices' in result and len(result['choices']) > 0:
                analysis_text = result['choices'][0]['message']['content']
                logger.info(f"Successfully analyzed frame {frame_index}, analysis length: {len(analysis_text)}")
                return {
                    'frame_index': frame_index,
                    'analysis': analysis_text,
                    'success': True
                }
            else:
                logger.warning(f"Unexpected response format from OpenRouter: {result}")
                return None
                
        except requests.exceptions.HTTPError as e:
            logger.error(f"OpenRouter API HTTP error: {e.response.status_code if e.response else 'unknown'} - {e.response.text[:500] if e.response else str(e)}", exc_info=True)
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenRouter API request error: {str(e)}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Unexpected error analyzing frame: {str(e)}", exc_info=True)
            return None
    
    def generate_recommendation(self, frame_analyses: List[Dict]) -> str:
        """
        Aggregate multiple frame analyses into a single recommendation
        
        Args:
            frame_analyses: List of frame analysis dictionaries
            
        Returns:
            Aggregated recommendation text
        """
        if not frame_analyses:
            return "Unable to analyze video. Please ensure the video contains a clear view of the baseball swing."
        
        # Extract all analysis texts
        analyses = [fa.get('analysis', '') for fa in frame_analyses if fa.get('success')]
        
        if not analyses:
            return "Unable to analyze video frames. Please ensure the video quality is good and the swing is clearly visible."
        
        # Combine all analyses
        combined_analysis = "\n\n".join(analyses)
        
        # Create a summary prompt for Claude
        summary_prompt = f"""Based on the following frame-by-frame analysis of a baseball swing, provide a concise, actionable recommendation (2-3 sentences) for improving the swing:

{combined_analysis}

Provide a clear, specific recommendation focusing on the most important areas for improvement."""
        
        try:
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": summary_prompt
                    }
                ],
                "max_tokens": 200
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": os.getenv('OPENROUTER_REFERER', 'https://baseballtrainer.app'),
                "X-Title": "Baseball Trainer"
            }
            
            response = requests.post(
                self.endpoint,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            if 'choices' in result and len(result['choices']) > 0:
                recommendation = result['choices'][0]['message']['content']
                return recommendation.strip()
            else:
                # Fallback: use first analysis if summary fails
                return analyses[0] if analyses else "Analysis completed, but unable to generate recommendation."
                
        except Exception as e:
            logger.error(f"Error generating recommendation: {str(e)}", exc_info=True)
            # Fallback: return first analysis
            return analyses[0] if analyses else "Analysis completed, but unable to generate recommendation."


