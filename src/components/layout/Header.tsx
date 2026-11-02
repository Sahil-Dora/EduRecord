import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../lib/constants'
import { getInitials, cn } from '../../lib/utils'

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="h-16 neu-base flex items-center justify-between px-4 md:px-6 border-b border-neutral-200/40">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2.5 rounded-xl text-neutral-600 hover:bg-surface-light active:shadow-neu-inset-sm transition-all"
        aria-label="Toggle menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1" />

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-surface-light active:shadow-neu-inset-sm transition-all"
        >
          <div className="h-9 w-9 rounded-xl neu-raised-sm flex items-center justify-center text-primary-700 text-sm font-semibold">
            {getInitials(profile?.full_name ?? '')}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-neutral-800 leading-tight">{profile?.full_name}</p>
            <p className="text-xs text-neutral-500 leading-tight">
              {profile ? ROLE_LABELS[profile.role] : ''}
            </p>
          </div>
          <svg className={cn('h-4 w-4 text-neutral-400 transition-transform', menuOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 neu-raised rounded-xl py-1 z-50">
            <div className="px-4 py-2 border-b border-neutral-200/60">
              <p className="text-sm font-medium text-neutral-800">{profile?.full_name}</p>
              <p className="text-xs text-neutral-500">{profile ? ROLE_LABELS[profile.role] : ''}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-surface-light transition-colors"
            >
              <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
