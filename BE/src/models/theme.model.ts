// A color theme (SCRUM-163). TypeTrace themes are published for everyone; a learner's own themes stay private.
import mongoose, { Schema, Types } from 'mongoose';
import { THEME_COLOR_FIELDS, ThemeColors } from '../utils/theme-colors';

export const THEME_MODES = ['dark', 'light'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** How many themes of their own a user may have. The built-in fallback of each mode is not counted. */
export const MAX_USER_THEMES = 9;

export const THEME_OWNER_NAME = 'TypeTrace';

export interface ThemeDocument extends mongoose.Document {
  name: string;
  /** Filled from `name` on save, do not set it by hand. Names are unique per owner, ignoring case. */
  nameLower: string;
  colors: ThemeColors;
  /** Which mode the theme belongs to: the dark theme list or the light one. Decided by the background color. */
  isDark: boolean;
  /** The user who created the theme. Empty only for seeded themes. Never sent to the client. */
  owner?: Types.ObjectId;
  /** Shown as the author: `TypeTrace` for the system, the user's name otherwise. */
  ownerName: string;
  /** Published themes are offered to everyone. Only TypeTrace themes are published; a learner's themes are private. */
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const colorsDefinition = Object.fromEntries(
  THEME_COLOR_FIELDS.map((field) => [field, { type: String, required: true, match: /^#[0-9a-f]{6}$/ }])
);

const themeSchema = new Schema<ThemeDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 30 },
    nameLower: { type: String, required: true },
    colors: { type: new Schema(colorsDefinition, { _id: false }), required: true },
    isDark: { type: Boolean, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ownerName: { type: String, trim: true, maxlength: 120, default: THEME_OWNER_NAME },
    published: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        delete ret.nameLower;
        delete ret.owner;
        return ret;
      }
    }
  }
);

// Keeps the lower-case name true whenever `name` changes through save() or create().
themeSchema.pre('validate', function () {
  if (this.isNew || this.isModified('name')) this.nameLower = this.name.trim().toLowerCase();
});

// One name once per owner (seeded themes have no owner, so their names are unique among themselves).
themeSchema.index({ owner: 1, nameLower: 1 }, { unique: true });
// Matches the theme list: published themes of one mode.
themeSchema.index({ published: 1, isDark: 1 });

export const ThemeModel = mongoose.model<ThemeDocument>('Theme', themeSchema);
