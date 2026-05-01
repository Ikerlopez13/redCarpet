import os
import requests
from openai import OpenAI

# API Key - Best practice is to set it as an environment variable
# export OPENAI_API_KEY='your-api-key-here'
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

ASSETS_DIR = "metadata/google_play_assets"
os.makedirs(ASSETS_DIR, exist_ok=True)

PROMPTS = {
    "feature_graphic": {
        "prompt": "A premium, high-tech feature graphic for a mobile app called RedCarpet. Urban Night with 'Red Carpet' illuminated routes, holographic AI assistant, and premium branding. 1024x500 pixels, dark mode aesthetic.",
        "size": "1024x1024", # DALL-E 3 usually handles 1024x1024, but we will resize or crop if needed, or use specific models. 
        # Note: DALL-E 3 supports 1024x1792 (vertical) and 1792x1024 (horizontal)
        "filename": "feature_graphic_auto.png",
        "aspect": "1792x1024" # Closest to 1024x500
    },
    "phone_screenshot": {
        "prompt": "A high-end, modern smartphone mockup showcasing the RedCarpet app (maps and navigation). 9:16 aspect ratio, sleek design, professional app store screenshot style.",
        "size": "1024x1792",
        "filename": "phone_screenshot_auto.png",
        "aspect": "1024x1792"
    },
    "tablet_screenshot": {
        "prompt": "A professional tablet mockup showcasing the RedCarpet app on a large screen with maps and group circles. 16:10 aspect ratio, premium dark mode aesthetic.",
        "size": "1792x1024",
        "filename": "tablet_screenshot_auto.png",
        "aspect": "1792x1024"
    }
}

def generate_asset(name, config):
    print(f"Generating {name}...")
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=config["prompt"],
            size=config["aspect"], # Usamos el aspecto que soporte la API
            quality="standard",
            n=1,
        )

        image_url = response.data[0].url
        img_data = requests.get(image_url).content
        
        path = os.path.join(ASSETS_DIR, config["filename"])
        with open(path, 'wb') as handler:
            handler.write(img_data)
        
        print(f"Done! Saved to {path}")
    except Exception as e:
        print(f"Error generating {name}: {e}")

if __name__ == "__main__":
    if not os.environ.get("OPENAI_API_KEY"):
        print("Missing OPENAI_API_KEY environment variable.")
    else:
        for name, config in PROMPTS.items():
            generate_asset(name, config)
