"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Settings as SettingsIcon, Shield, Server, Bot, Save } from 'lucide-react';
import styles from './page.module.scss';
import { Input } from '@/components/ui/Input';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Platform Settings</h1>
        <p className={styles.subtitle}>Configure global system preferences and AI behavior.</p>
      </header>

      <div className={styles.settingsLayout}>
        {/* Sidebar Navigation */}
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <button 
              className={`${styles.navItem} ${activeTab === 'general' ? styles.active : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <SettingsIcon size={18} /> General System
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'ai' ? styles.active : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <Bot size={18} /> AI Configuration
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'security' ? styles.active : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Shield size={18} /> Security & Auth
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'integrations' ? styles.active : ''}`}
              onClick={() => setActiveTab('integrations')}
            >
              <Server size={18} /> API Integrations
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className={styles.content}>
          {activeTab === 'general' && (
            <Card className={styles.settingsCard}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>General System Settings</h2>
                <p className={styles.cardDesc}>Global configuration for the ZenC Ecosystem platform.</p>
              </div>
              <div className={styles.cardBody}>
                <form className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Platform Name</label>
                    <Input defaultValue="ZenC Ecosystem" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Support Email</label>
                    <Input defaultValue="support@zenc.io" type="email" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Maintenance Mode</label>
                    <select className={styles.select}>
                      <option value="off">Off - System is Live</option>
                      <option value="on">On - Show Maintenance Page</option>
                    </select>
                    <p className={styles.helpText}>When enabled, only Admins can log in.</p>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Default Learner Quota / Month</label>
                    <Input defaultValue="5000" type="number" />
                    <p className={styles.helpText}>AI tokens allotted per user per month on the free tier.</p>
                  </div>
                </form>
              </div>
              <div className={styles.cardFooter}>
                <Button>
                  <Save size={16} className={styles.btnIcon} /> Save Settings
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'ai' && (
            <Card className={styles.settingsCard}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>AI Personality & Configuration</h2>
                <p className={styles.cardDesc}>Tune the behavior of the conversational and RAG agents.</p>
              </div>
              <div className={styles.cardBody}>
                <form className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Global System Prompt</label>
                    <textarea 
                      className={styles.textarea} 
                      rows={5}
                      defaultValue="You are an expert English tutor. You are polite, encouraging, and clear. You strictly correct grammatical mistakes gently after the user finishes speaking."
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Model Temperature (Creativity)</label>
                    <div className={styles.sliderGroup}>
                      <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" className={styles.slider} />
                      <span className={styles.sliderValue}>0.7</span>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Primary Speech Model</label>
                    <select className={styles.select}>
                      <option>gemini-2.5-flash-preview-native-audio-dialog</option>
                      <option>gemini-1.5-pro</option>
                      <option>claude-3-opus</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className={styles.cardFooter}>
                <Button>
                  <Save size={16} className={styles.btnIcon} /> Save Configuration
                </Button>
              </div>
            </Card>
          )}

          {(activeTab === 'security' || activeTab === 'integrations') && (
            <div className={styles.placeholderState}>
              <div className={styles.placeholderIcon}>🚧</div>
              <h3>Under Construction</h3>
              <p>This settings panel config will be integrated with the backend later.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
