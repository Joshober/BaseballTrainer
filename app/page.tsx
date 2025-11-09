import Link from 'next/link';
import { Rocket, Video, Target, Gamepad2 } from 'lucide-react';
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
              Training Doesn't Have to Feel Like Work
            </h2>
            <p className="text-2xl font-semibold text-blue-600 mb-4">
              We Make It Feel Like a Mission to Mars
            </p>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Transform your baseball training into an adventure. Upload your swings, get AI-powered feedback, and explore the world through gamified training.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/train"
                className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
              >
                <Rocket className="w-6 h-6" />
                Start Training
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 text-white rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl"
              >
                <Gamepad2 className="w-6 h-6" />
                Explore the World
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Link
              href="/train"
              className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow group"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Rocket className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">AI-Powered Training</h3>
              <p className="text-gray-600">
                Upload your swing videos and get instant AI coaching feedback to improve your form.
              </p>
            </Link>

            <Link
              href="/videos"
              className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow group"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <Video className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Your Video Library</h3>
              <p className="text-gray-600">
                Record, upload, and manage all your swing videos in one place.
              </p>
            </Link>

            <Link
              href="/drills"
              className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow group"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Personalized Drills</h3>
              <p className="text-gray-600">
                Get drill recommendations tailored to your swing analysis and improve faster.
              </p>
            </Link>

            <Link
              href="/explore"
              className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow group"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                <Gamepad2 className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Explore the World</h3>
              <p className="text-gray-600">
                Swing your way around the globe - travel to real locations based on your performance.
              </p>
            </Link>
          </div>

          {/* Mission Statement */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 md:p-12 text-white text-center">
            <h3 className="text-3xl font-bold mb-4">Your Mission Awaits</h3>
            <p className="text-lg text-blue-100 mb-6 max-w-2xl mx-auto">
              Every swing is a step closer to your next destination. Track your progress, improve your form, and explore the world - all while having fun.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3">
                <div className="text-2xl font-bold">AI-Powered</div>
                <div className="text-sm text-blue-100">Instant Feedback</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3">
                <div className="text-2xl font-bold">Gamified</div>
                <div className="text-sm text-blue-100">Training Made Fun</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3">
                <div className="text-2xl font-bold">Explore</div>
                <div className="text-sm text-blue-100">Travel the World</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
