import { Injectable, signal } from '@angular/core';

const THEME_KEY = 'halaqat_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** true = dark mode, false = light mode */
  isDark = signal<boolean>(this.loadPreference());

  constructor() {
    this.applyTheme(this.isDark());
  }

  toggle() {
    const next = !this.isDark();
    this.isDark.set(next);
    this.applyTheme(next);
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  }

  private applyTheme(dark: boolean) {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
    document.documentElement.classList.toggle('ion-palette-dark', dark);
  }

  private loadPreference(): boolean {
    const stored = localStorage.getItem(THEME_KEY);
    // Default: dark mode on first install
    if (stored === null) return true;
    return stored === 'dark';
  }
}
