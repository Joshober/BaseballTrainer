"""
Seed script to populate the drills database with initial data
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from services.drill_service import DrillService

# Load environment variables from root .env.local file
root_dir = Path(__file__).parent.parent.parent
env_local = root_dir / '.env.local'
if env_local.exists():
    load_dotenv(env_local)
    print(f"Loaded environment from {env_local}")
else:
    # Fallback to local .env file
    load_dotenv()
    print("Loaded environment from local .env file")

# Sample drills data
DRILLS = [
    {
        'name': 'Tee Work - Launch Angle',
        'description': 'Practice hitting off a tee to improve launch angle. Focus on hitting the ball with an upward angle.',
        'category': 'hitting',
        'difficulty': 'beginner',
        'equipment': ['bat', 'tee', 'baseballs'],
        'corrections': ['low_launch_angle', 'high_launch_angle'],
        'instructions': [
            'Set up a batting tee at waist height',
            'Position yourself with proper stance',
            'Focus on hitting the ball with an upward swing path',
            'Aim for a launch angle between 10-35 degrees',
            'Repeat 20-30 times'
        ],
        'duration': 15,
        'reps': 20,
        'tags': ['tee', 'launch_angle', 'fundamentals']
    },
    {
        'name': 'Hip Rotation Drill',
        'description': 'Improve hip rotation and power generation through the swing.',
        'category': 'hitting',
        'difficulty': 'intermediate',
        'equipment': [],
        'corrections': ['poor_hip_rotation'],
        'instructions': [
            'Stand in batting stance without a bat',
            'Practice rotating your hips forward',
            'Keep your front foot planted',
            'Feel the rotation in your core',
            'Repeat 15-20 times on each side'
        ],
        'duration': 10,
        'reps': 15,
        'tags': ['hip_rotation', 'power', 'core']
    },
    {
        'name': 'Shoulder Rotation Exercise',
        'description': 'Develop proper shoulder rotation for better swing mechanics.',
        'category': 'hitting',
        'difficulty': 'beginner',
        'equipment': [],
        'corrections': ['poor_shoulder_rotation'],
        'instructions': [
            'Stand in batting stance',
            'Slowly rotate your shoulders back',
            'Then rotate forward as if swinging',
            'Keep your hips engaged',
            'Repeat 20 times'
        ],
        'duration': 10,
        'reps': 20,
        'tags': ['shoulder_rotation', 'mechanics', 'warmup']
    },
    {
        'name': 'Bat Path Correction',
        'description': 'Correct steep or flat bat path for better contact.',
        'category': 'hitting',
        'difficulty': 'intermediate',
        'equipment': ['bat'],
        'corrections': ['steep_bat_path', 'flat_bat_path'],
        'instructions': [
            'Take slow practice swings',
            'Focus on a level bat path through the zone',
            'Visualize hitting through the ball',
            'Practice with a tee or soft toss',
            'Repeat 25-30 times'
        ],
        'duration': 15,
        'reps': 25,
        'tags': ['bat_path', 'contact', 'swing_plane']
    },
    {
        'name': 'Soft Toss - Launch Angle',
        'description': 'Practice hitting soft toss to improve launch angle consistency.',
        'category': 'hitting',
        'difficulty': 'intermediate',
        'equipment': ['bat', 'baseballs', 'partner'],
        'corrections': ['low_launch_angle'],
        'instructions': [
            'Have a partner toss balls from the side',
            'Focus on hitting the ball with an upward angle',
            'Aim for consistent launch angle',
            'Track your results',
            'Repeat 30-40 times'
        ],
        'duration': 20,
        'reps': 30,
        'tags': ['soft_toss', 'launch_angle', 'consistency']
    },
    {
        'name': 'Front Toss - Timing',
        'description': 'Improve timing and bat path with front toss drills.',
        'category': 'hitting',
        'difficulty': 'advanced',
        'equipment': ['bat', 'baseballs', 'partner'],
        'corrections': ['steep_bat_path', 'poor_timing'],
        'instructions': [
            'Have a partner toss from in front',
            'Focus on timing and bat path',
            'Keep your swing level through the zone',
            'Work on consistent contact',
            'Repeat 40-50 times'
        ],
        'duration': 25,
        'reps': 40,
        'tags': ['front_toss', 'timing', 'bat_path']
    },
    {
        'name': 'Dry Swing Practice',
        'description': 'Practice swing mechanics without a ball to build muscle memory.',
        'category': 'hitting',
        'difficulty': 'beginner',
        'equipment': ['bat'],
        'corrections': ['poor_shoulder_rotation', 'poor_hip_rotation'],
        'instructions': [
            'Take 50 dry swings focusing on form',
            'Emphasize hip and shoulder rotation',
            'Visualize hitting the ball',
            'Maintain proper balance',
            'Repeat daily'
        ],
        'duration': 15,
        'reps': 50,
        'tags': ['dry_swing', 'mechanics', 'muscle_memory']
    },
    {
        'name': 'Weighted Bat Swings',
        'description': 'Build strength and improve swing mechanics with a weighted bat.',
        'category': 'hitting',
        'difficulty': 'intermediate',
        'equipment': ['weighted_bat'],
        'corrections': ['poor_hip_rotation', 'poor_shoulder_rotation'],
        'instructions': [
            'Use a weighted bat (heavier than normal)',
            'Take 20-30 controlled swings',
            'Focus on proper rotation',
            'Don\'t swing too hard',
            'Follow with regular bat swings'
        ],
        'duration': 10,
        'reps': 25,
        'tags': ['weighted_bat', 'strength', 'rotation']
    },
    {
        'name': 'One-Handed Swings',
        'description': 'Improve bat control and path with one-handed swings.',
        'category': 'hitting',
        'difficulty': 'advanced',
        'equipment': ['bat'],
        'corrections': ['steep_bat_path', 'flat_bat_path'],
        'instructions': [
            'Take swings with only your top hand',
            'Focus on bat path and control',
            'Switch to bottom hand only',
            'Then use both hands',
            'Repeat 15-20 times each'
        ],
        'duration': 15,
        'reps': 15,
        'tags': ['one_handed', 'bat_control', 'bat_path']
    },
    {
        'name': 'Balance and Stability',
        'description': 'Improve balance and stability in your swing.',
        'category': 'hitting',
        'difficulty': 'beginner',
        'equipment': [],
        'corrections': ['poor_pose_detection'],
        'instructions': [
            'Practice your stance and balance',
            'Take slow swings while maintaining balance',
            'Focus on staying centered',
            'Work on weight transfer',
            'Repeat 20-30 times'
        ],
        'duration': 10,
        'reps': 25,
        'tags': ['balance', 'stability', 'fundamentals']
    }
]

def seed_drills():
    """Seed the drills database"""
    try:
        drill_service = DrillService()
        
        print("Seeding drills database...")
        
        for drill_data in DRILLS:
            # Check if drill already exists
            existing = drill_service.search_drills(query=drill_data['name'])
            if existing:
                print(f"  Skipping '{drill_data['name']}' (already exists)")
                continue
            
            drill = drill_service.create_drill(drill_data)
            print(f"  Created drill: {drill['name']}")
        
        print(f"\n✅ Successfully seeded {len(DRILLS)} drills!")
        
    except Exception as e:
        print(f"❌ Error seeding drills: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    seed_drills()

