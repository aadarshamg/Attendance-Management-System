import { useState } from 'react';
import { ACCENTS, applyAccent, getAccent, type AccentId } from '../lib/accent';

export function SettingsPage() {
  const [selected, setSelected] = useState<AccentId>(getAccent);

  const chooseAccent = (id: AccentId) => {
    setSelected(id);
    applyAccent(id, true);
  };

  return (
    <div className="settings-page">
      <header className="settings-heading">
        <div className="breadcrumb"><span>Workspace</span><i />Settings</div>
        <h1>Appearance</h1>
        <p>Personalize how TrackFlow looks on this device.</p>
      </header>

      <section className="settings-card">
        <div className="settings-card-copy">
          <div>
            <h2>Accent color</h2>
            <p>Choose the color used for buttons, active navigation, highlights, and focus states.</p>
          </div>
          <span className="device-setting">Saved on this device</span>
        </div>

        <div className="accent-options" role="radiogroup" aria-label="Accent color">
          {ACCENTS.map((accent) => (
            <button
              key={accent.id}
              className={`accent-option ${selected === accent.id ? 'selected' : ''}`}
              style={{ '--swatch': accent.primary, '--swatch-soft': accent.soft } as React.CSSProperties}
              role="radio"
              aria-checked={selected === accent.id}
              onClick={() => chooseAccent(accent.id)}
            >
              <span className="accent-swatch"><i /></span>
              <span>{accent.name}</span>
              <span className="accent-check" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card preview-card">
        <div className="settings-card-copy">
          <div><h2>Preview</h2><p>Your choice is applied instantly across the dashboard.</p></div>
        </div>
        <div className="accent-preview">
          <span className="preview-nav-dot" />
          <div className="preview-copy"><span /><span /></div>
          <span className="preview-badge">Active</span>
          <button type="button" tabIndex={-1}>Primary action</button>
        </div>
      </section>
    </div>
  );
}
