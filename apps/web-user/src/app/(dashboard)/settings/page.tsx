"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { User, Bell, Shield, Keyboard, Save } from 'lucide-react';
import styles from './page.module.scss';
import { useAuth } from '@/features/auth/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Account Settings</h1>
        <p className={styles.subtitle}>Manage your profile, preferences, and security.</p>
      </header>

      <div className={styles.settingsLayout}>
        {/* Sidebar Navigation for Settings */}
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <button 
              className={`${styles.navItem} ${activeTab === 'profile' ? styles.active : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} /> Profile
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'notifications' ? styles.active : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={18} /> Notifications
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'security' ? styles.active : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Shield size={18} /> Security
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'preferences' ? styles.active : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              <Keyboard size={18} /> Preferences
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className={styles.content}>
          {activeTab === 'profile' && (
            <Card className={styles.settingsCard}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Profile Information</h2>
                <p className={styles.cardDesc}>Update your personal details here.</p>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.avatarSection}>
                  <div className={styles.avatarPlaceholder}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <Button variant="outline" size="sm">Change Avatar</Button>
                </div>
                
                <form className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Full Name</label>
                    <Input defaultValue={user?.name || ''} placeholder="John Doe" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Email Address</label>
                    <Input defaultValue={user?.email || ''} type="email" disabled />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Learning Goal</label>
                    <select className={styles.select}>
                      <option>Casual Learning (15 min/day)</option>
                      <option>Regular Practice (30 min/day)</option>
                      <option>Intensive Study (60+ min/day)</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Native Language</label>
                    <select className={styles.select}>
                      <option>Vietnamese</option>
                      <option>English</option>
                      <option>Spanish</option>
                      <option>Japanese</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className={styles.cardFooter}>
                <Button>
                  <Save size={16} className={styles.btnIcon} /> Save Changes
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className={styles.settingsCard}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Change Password</h2>
                <p className={styles.cardDesc}>Ensure your account is using a long, random password to stay secure.</p>
              </div>
              <div className={styles.cardBody}>
                <form className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Current Password</label>
                    <Input type="password" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>New Password</label>
                    <Input type="password" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Confirm New Password</label>
                    <Input type="password" />
                  </div>
                </form>
              </div>
              <div className={styles.cardFooter}>
                <Button>Update Password</Button>
              </div>
            </Card>
          )}

          {(activeTab === 'notifications' || activeTab === 'preferences') && (
            <div className={styles.placeholderState}>
              <div className={styles.placeholderIcon}>🚧</div>
              <h3>Under Construction</h3>
              <p>This settings panel is coming in the next update.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
