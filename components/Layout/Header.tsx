'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Rocket, LayoutDashboard, Video, Target, Menu, X, Gamepad2 } from 'lucide-react';
import { getAuthUser } from '@/lib/auth0/client';
import UserMenu from '@/components/Navigation/UserMenu';
import type { Auth0User } from '@/lib/auth0/client';

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<Auth0User | null>(null);
  const [userRole, setUserRole] = useState<'player' | 'coach' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadUserRole = useCallback(async () => {
    try {
      const authUser = getAuthUser();
      if (!authUser) {
        setUser(null);
        return;
      }

      setUser(authUser);

      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`/api/users?uid=${authUser.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUserRole(userData.role || 'player');
      }
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  }, []);

  useEffect(() => {
    Promise.resolve()
      .then(loadUserRole)
      .catch((error) => {
        console.error('Failed to initialize header user state:', error);
      });
  }, [loadUserRole]);

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  const navLinks = [
    { 
      href: userRole === 'coach' ? '/coach' : '/player', 
      label: 'Dashboard', 
      icon: LayoutDashboard 
    },
    { href: '/videos', label: 'Videos', icon: Video },
    { href: '/train', label: 'Train', icon: Rocket },
    { href: '/drills', label: 'Drills', icon: Target },
    { href: '/fungo-universe', label: 'Explore', icon: Gamepad2 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Rocket className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900 hidden sm:block">Home Run to Mars</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <UserMenu />
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

