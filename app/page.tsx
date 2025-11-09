import Link from 'next/link';
import { Rocket, Trophy, Camera, MessageCircle } from 'lucide-react';
import AuthButton from '@/components/Auth/AuthButton';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <header className="flex justify-between items-center mb-16" role="banner">
            <div className="flex items-center gap-3">
              <Rocket className="w-8 h-8 text-blue-600" aria-hidden="true" focusable="false" />
              <h1 className="text-2xl font-bold text-gray-900">Home Run to Mars</h1>
            </div>
            <AuthButton />
          </header>

          <main>
            <section className="text-center mb-16">
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
                <Camera className="w-6 h-6" aria-hidden="true" focusable="false" />
                Start Mission
              </Link>
            </section>

            <section aria-labelledby="features-heading" className="grid md:grid-cols-3 gap-8 mb-16">
              <h2 id="features-heading" className="sr-only">Features</h2>
              <article className="p-6 bg-white rounded-lg shadow-md">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Camera className="w-6 h-6 text-blue-600" aria-hidden="true" focusable="false" />
                </div>
                <h3 className="text-xl font-semibold mb-2">AI Pose Detection</h3>
                <p className="text-gray-600">
                  Advanced on-device and server-side pose detection to analyze your swing angle and
                  form.
                </p>
              </article>

              <article className="p-6 bg-white rounded-lg shadow-md">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Rocket className="w-6 h-6 text-purple-600" aria-hidden="true" focusable="false" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Space Zones</h3>
                <p className="text-gray-600">
                  Track your progress through Atmosphere, Low Earth Orbit, Moon, and Mars based on
                  your swing metrics.
                </p>
              </article>

              <article className="p-6 bg-white rounded-lg shadow-md">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Trophy className="w-6 h-6 text-green-600" aria-hidden="true" focusable="false" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Compete with Friends</h3>
                <p className="text-gray-600">
                  Join teams, chat with coaches, and compare milestones on the Mars leaderboard.
                </p>
              </article>
            </section>

            <section className="bg-white rounded-2xl shadow-xl p-8 md:p-12" aria-labelledby="cta-heading">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 id="cta-heading" className="text-3xl font-bold text-gray-900 mb-4">
                    Capture, Analyze, and Improve Your Swing
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Record your swings on your phone, run instant AI analysis, and get tailored drills
                    from your coaches. Visualize progress across a space-themed skill tree.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Link
                      href="/blast-off"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Rocket className="w-5 h-5" aria-hidden="true" focusable="false" />
                      Launch Analysis
                    </Link>
                    <Link
                      href="/videos"
                      className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" aria-hidden="true" focusable="false" />
                      View Library
                    </Link>
                  </div>
                </div>

                <aside className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl shadow-inner" aria-label="Programming Highlights">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">What's included</h3>
                  <ul className="space-y-3 text-gray-600 list-disc list-inside">
                    <li>Instant pose detection on desktop or mobile.</li>
                    <li>Coach dashboards for team-wide progress.</li>
                    <li>Mission points that unlock Mars milestones.</li>
                  </ul>
                </aside>
              </div>
            </section>
          </main>

          <footer className="mt-16 text-center text-sm text-gray-500" role="contentinfo">
            © {new Date().getFullYear()} Home Run to Mars. Built for the Baseball Swing MVP hackathon.
          </footer>
        </div>
      </div>
    </div>
  );
}
