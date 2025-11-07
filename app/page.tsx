import Link from 'next/link';
import { Rocket, Trophy, Camera } from 'lucide-react';
import AuthButton from '@/components/Auth/AuthButton';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-3">
              <Rocket className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Home Run to Mars</h1>
            </div>
            <AuthButton />
          </header>

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-gray-900 mb-4">
              Launch Your Swing to Mars
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Capture your baseball swing, analyze it with AI pose detection, and see how far your
              ball travels through space zones from Atmosphere to Mars!
            </p>
            <Link
              href="/mission"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <Camera className="w-6 h-6" />
              Start Mission
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="p-6 bg-white rounded-lg shadow-md">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Camera className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Pose Detection</h3>
              <p className="text-gray-600">
                Advanced on-device and server-side pose detection to analyze your swing angle and
                form.
              </p>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-md">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Rocket className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Space Zones</h3>
              <p className="text-gray-600">
                Track your progress through Atmosphere, Low Earth Orbit, Moon, and Mars based on
                your swing metrics.
              </p>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-md">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Leaderboard</h3>
              <p className="text-gray-600">
                Compete with your team and see who can launch their swing the farthest into space.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              <Trophy className="w-5 h-5" />
              View Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
