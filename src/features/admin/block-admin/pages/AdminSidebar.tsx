import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaCheckCircle, FaUsers, FaCog, FaSignOutAlt, FaTimes } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiFetch } from "@/services/activApi";

type Props = {
  className?: string;
  onClose?: () => void;
  isOpen?: boolean;
  refreshTrigger?: number;
};

export default function AdminSidebar({ className = '', onClose, isOpen = false, refreshTrigger = 0 }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminInfo, setAdminInfo] = useState<any>(null);

  const role = (typeof window !== 'undefined' ? localStorage.getItem('role') : '') || '';
  
  // Use useMemo to ensure these update when adminInfo changes
  const userName = useMemo(() => {
    return adminInfo?.fullName || (typeof window !== 'undefined' ? localStorage.getItem('userName') : '') || 'Admin';
  }, [adminInfo]);
  
  const avatarUrl = useMemo(() => {
    return adminInfo?.avatarUrl || '';
  }, [adminInfo]);
  
  const roleLabel = role === 'block_admin' ? 'Block Admin' : role === 'district_admin' ? 'District Admin' : role === 'state_admin' ? 'State Admin' : role === 'super_admin' ? 'Super Admin' : 'Admin';
  const initials = role === 'block_admin' ? 'BA' : role === 'district_admin' ? 'DA' : role === 'state_admin' ? 'SA' : role === 'super_admin' ? 'SU' : (userName || 'A').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const nav = [
    { to: '/block-admin/dashboard', label: 'Dashboard', icon: <FaHome /> },
    { to: '/block-admin/approvals', label: 'Approvals', icon: <FaCheckCircle /> },
    { to: '/block-admin/members', label: 'Members', icon: <FaUsers /> },
    { to: '/block-admin/settings', label: 'Settings', icon: <FaCog /> },
  ];

  // Fetch admin info
  const fetchAdminInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await apiFetch('/admin/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAdminInfo(data.data);
        if (data.data) {
          localStorage.setItem('userName', data.data.fullName);
          localStorage.setItem('userEmail', data.data.email);
        }
      }
    } catch (error) {
      console.error('❌ Sidebar: Error fetching admin info:', error);
    }
  };

  useEffect(() => {
    fetchAdminInfo();
  }, [refreshTrigger]);

  const handleLogout = () => {
    // Clear all local storage items related to login
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('memberId');
    localStorage.removeItem('userName');
    localStorage.removeItem('role');
    localStorage.removeItem('isAdminLoggedIn');
    localStorage.removeItem('adminId');
    localStorage.removeItem('sessionStart');

    // Navigate to main login page
    navigate('/login');
    if (onClose) onClose();
  };

  // Sidebar content component (reused for both mobile and desktop)
  const SidebarContent = () => (
    <>
      {/* Logo/Brand Section */}
      <div className="p-4 md:p-6 border-b border-white/20">
        <div className="flex items-center justify-between">
          {/* Close button only visible on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden text-white hover:bg-white/20"
          >
            <FaTimes className="h-5 w-5" />
          </Button>
          <div className="flex items-center justify-center flex-1">
            <img
              src="/logo_ACTIVian-removebg-preview.png"
              alt="ACTIVian Logo"
              className="h-10 md:h-12 lg:h-14 w-auto object-contain brightness-0 invert"
            />
          </div>
        </div>
      </div>

      {/* User Profile Section */}
      <div 
        className="p-4 md:p-6 border-b border-white/20 cursor-pointer hover:bg-white/10 transition-colors"
        onClick={() => {
          navigate('/block-admin/settings');
          onClose?.();
        }}
        title="Click to edit profile"
      >
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 ring-2 ring-white/30 shadow-lg flex-shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
            <AvatarFallback className="bg-white/20 backdrop-blur-sm text-white font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm truncate">{userName}</div>
            <div className="text-xs text-blue-100 font-medium truncate">{roleLabel}</div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 md:p-4 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {nav.map((item) => {
            const active = location.pathname === item.to ||
              (item.to !== '/block-admin/dashboard' && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => onClose?.()}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
                  ? 'bg-white text-blue-600 shadow-lg'
                  : 'text-white hover:bg-white/20 backdrop-blur-sm'
                  }`}
              >
                <span className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-white'}`}>
                  {item.icon}
                </span>
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Logout Button */}
      <div className="p-3 md:p-4 border-t border-white/20">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 text-white hover:bg-red-500/80 hover:text-white py-3 px-4 rounded-xl justify-start transition-all duration-200 backdrop-blur-sm"
        >
          <FaSignOutAlt className="w-5 h-5" />
          <span className="font-medium text-sm">Log out</span>
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop/Tablet: Permanent Sidebar - Always visible on md screens and above */}
      <div className="hidden md:flex md:flex-col md:w-64 lg:w-64 bg-gradient-to-b from-blue-600 via-purple-600 to-indigo-700 shadow-lg relative overflow-hidden h-screen sticky top-0">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl"></div>

        <div className="relative z-10 h-full flex flex-col">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile: Slide-out Menu - Only on small screens */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black opacity-50" onClick={onClose}></div>
          <div className="absolute left-0 top-0 bottom-0 w-4/5 max-w-sm bg-gradient-to-b from-blue-600 via-purple-600 to-indigo-700 shadow-lg relative overflow-hidden flex flex-col">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl"></div>

            <div className="relative z-10 h-full flex flex-col">
              <SidebarContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
