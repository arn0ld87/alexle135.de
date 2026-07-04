#!/usr/bin/env python3
"""
Generate preview images for alexle135.de projects
Following the brand design: dark theme, blue accents (#3b82f6), glassmorphism
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Brand colors
DARK_BG = (10, 12, 16)  # Very dark blue-black
BLUE_ACCENT = (59, 130, 246)  # #3b82f6
LIGHT_TEXT = (255, 255, 255)
GRAY_TEXT = (156, 163, 175)

# Image dimensions (16:9 aspect ratio for better preview)
WIDTH = 1200
HEIGHT = 630

def create_base_image():
    """Create base image with dark gradient background"""
    img = Image.new('RGB', (WIDTH, HEIGHT), DARK_BG)
    draw = ImageDraw.Draw(img, 'RGBA')

    # Add subtle gradient effect
    for i in range(HEIGHT):
        alpha = int(20 * (i / HEIGHT))
        draw.rectangle([(0, i), (WIDTH, i+1)], fill=(BLUE_ACCENT[0], BLUE_ACCENT[1], BLUE_ACCENT[2], alpha))

    return Image.alpha_composite(img.convert('RGBA'), Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0)))

def draw_glassmorphism_card(draw, x, y, w, h):
    """Draw a glassmorphism-style card"""
    # Semi-transparent white background
    draw.rounded_rectangle(
        [(x, y), (x + w, y + h)],
        radius=12,
        fill=(255, 255, 255, 8),
        outline=(255, 255, 255, 20),
        width=2
    )

def draw_icon_docker(draw, x, y, size=100):
    """Draw Docker whale icon (simplified)"""
    # Whale body
    draw.rounded_rectangle(
        [(x, y + size//3), (x + size, y + size)],
        radius=15,
        fill=BLUE_ACCENT
    )

    # Container boxes on top
    box_width = size // 4
    for i in range(3):
        draw.rectangle(
            [(x + 10 + i * (box_width + 5), y), (x + 10 + i * (box_width + 5) + box_width, y + size//3 - 5)],
            fill=BLUE_ACCENT
        )

def draw_icon_tools(draw, x, y, size=100):
    """Draw tools icon (wrench + screwdriver)"""
    # Wrench
    draw.line([(x + 20, y + 20), (x + 60, y + 60)], fill=BLUE_ACCENT, width=8)
    draw.ellipse([(x + 15, y + 15), (x + 35, y + 35)], outline=BLUE_ACCENT, width=6)

    # Screwdriver
    draw.line([(x + 80, y + 20), (x + 40, y + 60)], fill=BLUE_ACCENT, width=8)
    draw.polygon([(x + 85, y + 15), (x + 75, y + 25), (x + 80, y + 20)], fill=BLUE_ACCENT)

def draw_icon_kubernetes(draw, x, y, size=100):
    """Draw Kubernetes logo (simplified hexagon with spokes)"""
    # Hexagon
    points = []
    import math
    for i in range(6):
        angle = math.radians(60 * i - 30)
        px = x + size//2 + int(size//2 * math.cos(angle))
        py = y + size//2 + int(size//2 * math.sin(angle))
        points.append((px, py))

    draw.polygon(points, outline=BLUE_ACCENT, width=4)

    # Center circle
    center_x, center_y = x + size//2, y + size//2
    draw.ellipse(
        [(center_x - 15, center_y - 15), (center_x + 15, center_y + 15)],
        fill=BLUE_ACCENT
    )

    # Spokes
    for i in range(6):
        angle = math.radians(60 * i - 30)
        end_x = center_x + int(size//3 * math.cos(angle))
        end_y = center_y + int(size//3 * math.sin(angle))
        draw.line([(center_x, center_y), (end_x, end_y)], fill=BLUE_ACCENT, width=3)

def draw_icon_server(draw, x, y, size=100):
    """Draw server/homelab icon (stacked servers)"""
    server_height = size // 3 - 5
    for i in range(3):
        y_pos = y + i * (server_height + 5)
        # Server box
        draw.rounded_rectangle(
            [(x, y_pos), (x + size, y_pos + server_height)],
            radius=5,
            fill=(255, 255, 255, 15),
            outline=BLUE_ACCENT,
            width=2
        )
        # LED indicators
        for j in range(3):
            draw.ellipse(
                [(x + 10 + j * 15, y_pos + 8), (x + 20 + j * 15, y_pos + 18)],
                fill=BLUE_ACCENT if j == 0 else (100, 100, 100)
            )

def create_docker_setup_image():
    """Create preview image for Docker on Ubuntu setup"""
    img = create_base_image()
    draw = ImageDraw.Draw(img, 'RGBA')

    # Draw Docker icon
    draw_icon_docker(draw, 100, HEIGHT//2 - 100, 180)

    # Draw glassmorphism card
    draw_glassmorphism_card(draw, 350, HEIGHT//2 - 120, 750, 240)

    # Try to load fonts, fallback to default
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
        tag_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        tag_font = ImageFont.load_default()

    # Draw text
    draw.text((400, HEIGHT//2 - 80), "Docker auf Ubuntu", fill=LIGHT_TEXT, font=title_font)
    draw.text((400, HEIGHT//2 - 10), "Installation & Setup-Guide", fill=GRAY_TEXT, font=subtitle_font)

    # Tags
    tags = ["Docker", "Ubuntu 24.04", "Linux", "Tutorial"]
    x_offset = 400
    for tag in tags:
        tag_width = draw.textlength(tag, font=tag_font) + 24
        draw.rounded_rectangle(
            [(x_offset, HEIGHT//2 + 50), (x_offset + tag_width, HEIGHT//2 + 85)],
            radius=20,
            fill=(255, 255, 255, 15)
        )
        draw.text((x_offset + 12, HEIGHT//2 + 57), tag, fill=BLUE_ACCENT, font=tag_font)
        x_offset += tag_width + 12

    return img.convert('RGB')

def create_fisi_tools_image():
    """Create preview image for FISI Tools"""
    img = create_base_image()
    draw = ImageDraw.Draw(img, 'RGBA')

    # Draw tools icon
    draw_icon_tools(draw, 100, HEIGHT//2 - 100, 180)

    # Draw glassmorphism card
    draw_glassmorphism_card(draw, 350, HEIGHT//2 - 120, 750, 240)

    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
        tag_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        tag_font = ImageFont.load_default()

    draw.text((400, HEIGHT//2 - 80), "5 FISI Tools", fill=LIGHT_TEXT, font=title_font)
    draw.text((400, HEIGHT//2 - 10), "Produktivität & Lern-Beschleunigung", fill=GRAY_TEXT, font=subtitle_font)

    tags = ["Obsidian", "Claude/ChatGPT", "Anki", "tmux", "Git"]
    x_offset = 400
    for tag in tags:
        tag_width = draw.textlength(tag, font=tag_font) + 24
        draw.rounded_rectangle(
            [(x_offset, HEIGHT//2 + 50), (x_offset + tag_width, HEIGHT//2 + 85)],
            radius=20,
            fill=(255, 255, 255, 15)
        )
        draw.text((x_offset + 12, HEIGHT//2 + 57), tag, fill=BLUE_ACCENT, font=tag_font)
        x_offset += tag_width + 12
        if x_offset > 1000:  # Wrap to next line if needed
            break

    return img.convert('RGB')

def create_kubernetes_hype_image():
    """Create preview image for Kubernetes Reality article"""
    img = create_base_image()
    draw = ImageDraw.Draw(img, 'RGBA')

    # Draw Kubernetes icon
    draw_icon_kubernetes(draw, 100, HEIGHT//2 - 100, 180)

    # Draw glassmorphism card
    draw_glassmorphism_card(draw, 350, HEIGHT//2 - 120, 750, 240)

    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 50)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
        tag_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        tag_font = ImageFont.load_default()

    draw.text((400, HEIGHT//2 - 80), "Kubernetes Realität", fill=LIGHT_TEXT, font=title_font)
    draw.text((400, HEIGHT//2 - 10), "Wann K8s Sinn macht (und wann nicht)", fill=GRAY_TEXT, font=subtitle_font)

    tags = ["Kubernetes", "Docker Compose", "DevOps", "Realität"]
    x_offset = 400
    for tag in tags:
        tag_width = draw.textlength(tag, font=tag_font) + 24
        draw.rounded_rectangle(
            [(x_offset, HEIGHT//2 + 50), (x_offset + tag_width, HEIGHT//2 + 85)],
            radius=20,
            fill=(255, 255, 255, 15)
        )
        draw.text((x_offset + 12, HEIGHT//2 + 57), tag, fill=BLUE_ACCENT, font=tag_font)
        x_offset += tag_width + 12

    return img.convert('RGB')

def create_proxmox_homelab_image():
    """Create preview image for Proxmox Homelab"""
    img = create_base_image()
    draw = ImageDraw.Draw(img, 'RGBA')

    # Draw server icon
    draw_icon_server(draw, 100, HEIGHT//2 - 100, 180)

    # Draw glassmorphism card
    draw_glassmorphism_card(draw, 350, HEIGHT//2 - 120, 750, 240)

    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
        tag_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        tag_font = ImageFont.load_default()

    draw.text((400, HEIGHT//2 - 80), "Proxmox Heimlabor", fill=LIGHT_TEXT, font=title_font)
    draw.text((400, HEIGHT//2 - 10), "Server-Setup für unter 500€", fill=GRAY_TEXT, font=subtitle_font)

    tags = ["Proxmox", "Homelab", "VMs", "Virtualisierung"]
    x_offset = 400
    for tag in tags:
        tag_width = draw.textlength(tag, font=tag_font) + 24
        draw.rounded_rectangle(
            [(x_offset, HEIGHT//2 + 50), (x_offset + tag_width, HEIGHT//2 + 85)],
            radius=20,
            fill=(255, 255, 255, 15)
        )
        draw.text((x_offset + 12, HEIGHT//2 + 57), tag, fill=BLUE_ACCENT, font=tag_font)
        x_offset += tag_width + 12

    return img.convert('RGB')

if __name__ == "__main__":
    output_dir = "/home/user/alexle-vsco/media"
    os.makedirs(output_dir, exist_ok=True)

    print("Generating preview images...")

    # Generate images
    images = {
        "docker-setup.png": create_docker_setup_image,
        "fisi-tools.png": create_fisi_tools_image,
        "kubernetes-hype.png": create_kubernetes_hype_image,
        "proxmox-homelab.png": create_proxmox_homelab_image,
    }

    for filename, create_func in images.items():
        print(f"Creating {filename}...")
        img = create_func()
        img.save(os.path.join(output_dir, filename))
        print(f"✓ Saved {filename}")

    print("\nAll preview images generated successfully!")
